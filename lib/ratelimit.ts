// ─── Rate-Limiting (Upstash) ─────────────────────────────
// FAIL-OPEN: Ist Upstash nicht konfiguriert (z. B. lokal in der Entwicklung)
// oder kurz nicht erreichbar, werden Anfragen DURCHGELASSEN — Rate-Limiting
// darf niemals das Login oder die App komplett blockieren. Auf Vercel sind
// KV_REST_API_URL/TOKEN gesetzt, dort ist der Schutz aktiv.
//
// Vorbereitung für Phase 2: Aus denselben Bausteinen werden später
// Tenant-Kontingente (pro Mandant statt pro IP).

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

const redis = getRedis();

// Login: 5 Versuche pro IP pro 15 Minuten (Sliding Window)
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "rl:auth",
      analytics: false,
    })
  : null;

// KI-Routen: 30 Aufrufe pro IP pro Stunde (Sliding Window)
export const aiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      prefix: "rl:ai",
      analytics: false,
    })
  : null;

// Admin-Konsole: 10 FEHLVERSUCHE pro IP pro 15 Minuten (nur falsche Tokens zählen,
// legitime Nutzung wird nie gezählt → Brute-Force auf ADMIN_PASSWORD gedrosselt)
export const adminLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      prefix: "rl:admin",
      analytics: false,
    })
  : null;

// Client-IP aus den (Vercel-)Headern lesen
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix-ms, wann das Fenster zurückgesetzt wird
  retryAfterSec: number;
};

// Zentrale Prüfung. Ohne konfiguriertes Upstash (limiter === null) immer ok.
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateResult> {
  if (!limiter) {
    return { ok: true, limit: 0, remaining: 0, reset: 0, retryAfterSec: 0 };
  }
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    const retryAfterSec = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    return { ok: success, limit, remaining, reset, retryAfterSec };
  } catch {
    // Upstash nicht erreichbar → durchlassen, nicht blockieren
    return { ok: true, limit: 0, remaining: 0, reset: 0, retryAfterSec: 0 };
  }
}

// Fertige 429-Antwort mit deutscher Meldung + Retry-After-Header
export function tooManyRequests(retryAfterSec: number, message: string): Response {
  return Response.json(
    { error: message, retryAfter: retryAfterSec },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSec)) } },
  );
}
