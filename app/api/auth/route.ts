import { authLimiter, checkRateLimit, getClientIp, tooManyRequests } from "@/lib/ratelimit";

export const maxDuration = 10;

const LOG_KEY = "desi_login_log";
const MAX_ENTRIES = 25;

function getUpstashConfig(): { url: string; token: string } | null {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvGet(cfg: { url: string; token: string }, key: string): Promise<unknown> {
  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json() as { result: string | null };
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
}

async function kvSet(cfg: { url: string; token: string }, key: string, value: unknown): Promise<void> {
  await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(5000),
  });
}

function parseDevice(ua: string): string {
  if (!ua) return "🌐 Unbekannt";
  if (/iPhone/i.test(ua))  return "📱 iPhone";
  if (/iPad/i.test(ua))    return "📱 iPad";
  if (/Android/i.test(ua)) return "📱 Android";
  if (/Mac OS/i.test(ua)) {
    if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return "💻 Chrome / Mac";
    if (/Firefox/i.test(ua)) return "💻 Firefox / Mac";
    if (/Safari/i.test(ua))  return "🍎 Safari / Mac";
    return "💻 Mac";
  }
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua))  return "🖥️ Chrome / Windows";
    if (/Firefox/i.test(ua)) return "🖥️ Firefox / Windows";
    if (/Edge/i.test(ua))    return "🖥️ Edge / Windows";
    return "🖥️ Windows";
  }
  if (/Linux/i.test(ua)) return "🐧 Linux";
  return "🌐 Unbekannt";
}

// Geo aus Vercel-Edge-Headern — kein externer Call mit Besucher-IPs (DSGVO).
function geoFromHeaders(req: Request): { city?: string; country?: string } {
  const dec = (v: string | null) => {
    if (!v) return "";
    try { return decodeURIComponent(v); } catch { return v; }
  };
  const city    = dec(req.headers.get("x-vercel-ip-city"));
  const country = dec(req.headers.get("x-vercel-ip-country"));
  if (!city && !country) return {};
  return { city, country };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Brute-Force-Schutz: max. 5 Versuche pro IP / 15 Minuten
  const rl = await checkRateLimit(authLimiter, ip);
  if (!rl.ok) {
    const min = Math.ceil(rl.retryAfterSec / 60);
    return tooManyRequests(
      rl.retryAfterSec,
      `Zu viele Anmeldeversuche. Bitte versuche es in ${min} Minute${min === 1 ? "" : "n"} erneut.`,
    );
  }

  const { password } = await req.json() as { password?: string };
  const correct = process.env.APP_PASSWORD;
  const ua = req.headers.get("user-agent") || "";
  const geo = geoFromHeaders(req);

  if (!correct || password !== correct) {
    const cfg = getUpstashConfig();
    if (cfg) {
      const existing = await (kvGet(cfg, LOG_KEY) as Promise<LoginEntry[] | null>);
      const entry: LoginEntry = { ts: Date.now(), ip, device: parseDevice(ua), success: false, ...geo };
      await kvSet(cfg, LOG_KEY, [entry, ...(existing || [])].slice(0, MAX_ENTRIES));
    }
    return Response.json({ ok: false }, { status: 401 });
  }

  const cfg = getUpstashConfig();
  if (cfg) {
    try {
      const existing = await (kvGet(cfg, LOG_KEY) as Promise<LoginEntry[] | null>);
      const entry: LoginEntry = { ts: Date.now(), ip, device: parseDevice(ua), success: true, ...geo };
      await kvSet(cfg, LOG_KEY, [entry, ...(existing || [])].slice(0, MAX_ENTRIES));
    } catch {}
  }

  return Response.json({ ok: true });
}

type LoginEntry = { ts: number; ip: string; device: string; success: boolean; city?: string; country?: string };
