// ─── Remote-Feature-Flags (Stufe-1-Admin-Konsole) ────────
// Ein Flags-Objekt pro Instanz in Upstash-KV (admin_flags_v1), das der Server
// bei jedem Request liest (30 s gecacht). Damit lassen sich Module freischalten/
// sperren, die KI drosseln und die Instanz in Nur-Lese-/Sperr-Status setzen —
// OHNE Deploy. Phase 2 liest dieselbe Struktur später pro Tenant aus Postgres;
// die guardFeature()-Schnittstelle bleibt identisch (nur die Quelle wechselt).
//
// FAIL-OPEN: Ohne KV oder bei Lesefehler gelten die Default-Flags (alles an) —
// eine kaputte KV-Verbindung darf die Kundin nie aussperren.

import { getKvConfig, kvGet, kvSet } from "./kv";

export const FLAGS_KEY = "admin_flags_v1";

// Modul-Schlüssel = Sidebar-href ohne führenden Slash.
// Dashboard ("/") und Einstellungen ("/settings") sind immer aktiv.
export const MODULE_KEYS = [
  "ideen", "research", "trends", "content", "editor", "repurpose",
  "hashtags", "captions", "vision", "planner", "email", "analytics",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  ideen: "Ideen-Pool", research: "Research", trends: "Trend-Radar",
  content: "Content", editor: "Editor", repurpose: "Repurpose",
  hashtags: "Hashtags", captions: "Caption-Bank", vision: "Mein Northstar",
  planner: "Planer", email: "E-Mail", analytics: "Analytics",
};

export type AdminStatus = "active" | "readonly" | "locked";

export type AdminFlags = {
  modules: Partial<Record<ModuleKey, boolean>>; // fehlender Key = an (fail-open)
  ai: { enabled: boolean; monthlyLimit: number }; // monthlyLimit 0 = unbegrenzt
  status: AdminStatus;
  banner: string;
  updatedAt: number;
};

export const DEFAULT_FLAGS: AdminFlags = {
  modules: {},
  ai: { enabled: true, monthlyLimit: 0 },
  status: "active",
  banner: "",
  updatedAt: 0,
};

// Eingehende (untrusted) Flags in ein sauberes AdminFlags-Objekt normalisieren.
export function normalizeFlags(raw: unknown): AdminFlags {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const modulesIn = (r.modules && typeof r.modules === "object" ? r.modules : {}) as Record<string, unknown>;
  const modules: Partial<Record<ModuleKey, boolean>> = {};
  for (const k of MODULE_KEYS) {
    if (k in modulesIn) modules[k] = modulesIn[k] !== false;
  }
  const aiIn = (r.ai && typeof r.ai === "object" ? r.ai : {}) as Record<string, unknown>;
  const status: AdminStatus =
    r.status === "readonly" || r.status === "locked" ? r.status : "active";
  const limitNum = Number(aiIn.monthlyLimit);
  return {
    modules,
    ai: {
      enabled: aiIn.enabled !== false,
      monthlyLimit: Number.isFinite(limitNum) && limitNum > 0 ? Math.floor(limitNum) : 0,
    },
    status,
    banner: typeof r.banner === "string" ? r.banner.slice(0, 280) : "",
    updatedAt: Number(r.updatedAt) || 0,
  };
}

export function moduleEnabled(flags: AdminFlags, key: ModuleKey): boolean {
  return flags.modules[key] !== false;
}

// 30-Sekunden-In-Memory-Cache (pro Serverless-Instanz). Genug, um Lastspitzen
// abzufedern, kurz genug, dass Änderungen zeitnah greifen.
let cache: { flags: AdminFlags; at: number } | null = null;
const CACHE_MS = 30_000;

export async function getFlags(): Promise<AdminFlags> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.flags;

  const cfg = getKvConfig();
  if (!cfg) {
    cache = { flags: DEFAULT_FLAGS, at: now };
    return DEFAULT_FLAGS;
  }
  try {
    const raw = await kvGet(cfg, FLAGS_KEY);
    const flags = raw ? normalizeFlags(raw) : DEFAULT_FLAGS;
    cache = { flags, at: now };
    return flags;
  } catch {
    // KV nicht erreichbar → fail-open mit Defaults, nicht aussperren
    return DEFAULT_FLAGS;
  }
}

export function invalidateFlagsCache(): void {
  cache = null;
}

export async function setFlags(next: AdminFlags): Promise<void> {
  const cfg = getKvConfig();
  if (!cfg) throw new Error("KV nicht konfiguriert — Flags können nicht gespeichert werden.");
  await kvSet(cfg, FLAGS_KEY, next);
  invalidateFlagsCache();
}

// ── Serverseitiger KI-Verbrauch (pro Monat) ──────────────
// Getrennt vom clientseitigen dh_token_usage (das nur im Browser der Kundin liegt).
// Dieser Zähler ist die Grundlage für Monatslimit + Admin-Anzeige.
export function usageMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}
function usageKey(month = usageMonth()): string {
  return `admin_ai_usage_${month}`;
}

export async function getAiUsage(month = usageMonth()): Promise<number> {
  const cfg = getKvConfig();
  if (!cfg) return 0;
  try {
    const raw = await kvGet(cfg, usageKey(month));
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function incrAiUsage(): Promise<void> {
  const cfg = getKvConfig();
  if (!cfg) return;
  try {
    // Atomarer Zähler via Upstash INCR
    await fetch(`${cfg.url}/incr/${encodeURIComponent(usageKey())}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* Zählen ist Best-Effort, darf die KI-Antwort nie blockieren */ }
}

// ── Enforcement ──────────────────────────────────────────
// Nach requireAuth aufrufen. Gibt eine fertige 403-Response zurück, wenn die
// Aktion durch Flags gesperrt ist, sonst null.
function blocked(reason: string, message: string): Response {
  return Response.json({ error: message, blocked: true, reason }, { status: 403 });
}

export async function guardFeature(opts: {
  module?: ModuleKey;
  ai?: boolean;
  write?: boolean;
}): Promise<Response | null> {
  const flags = await getFlags();

  if (flags.status === "locked") {
    return blocked("locked", "Diese Instanz ist derzeit gesperrt. Bitte wende dich an den Betreiber.");
  }
  if (opts.write && flags.status === "readonly") {
    return blocked("readonly", "Nur-Lese-Modus aktiv — Änderungen sind derzeit deaktiviert.");
  }
  if (opts.module && !moduleEnabled(flags, opts.module)) {
    return blocked("module_disabled", "Dieser Bereich ist für deine Instanz derzeit nicht freigeschaltet.");
  }
  if (opts.ai) {
    if (!flags.ai.enabled) {
      return blocked("ai_disabled", "Die KI-Funktionen sind derzeit deaktiviert.");
    }
    if (flags.ai.monthlyLimit > 0) {
      const used = await getAiUsage();
      if (used >= flags.ai.monthlyLimit) {
        return blocked("ai_limit", "Das KI-Kontingent für diesen Monat ist aufgebraucht.");
      }
    }
  }
  return null;
}
