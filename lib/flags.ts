// ─── Entitlements / Feature-Flags (Postgres, pro Tenant) ─
// Quelle ist jetzt die entitlements-Tabelle (+ tenants.status), nicht mehr der
// globale KV-Key. Die guardFeature()-Schnittstelle bleibt bewusst gleich (nur
// mit tenantId erweitert) — Phase-2-Vorbereitung ist damit erfüllt.
//
// FAIL-OPEN: Bei DB-Fehler gelten die Default-Flags (alles an) — eine kaputte
// Verbindung darf die Kundin nie aussperren.

import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { tenants, entitlements, usage } from "./db/schema";
import { planAiLimit } from "./plans";

// Modul-Schlüssel = Sidebar-href ohne führenden Slash.
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

// Untrusted-Eingabe → sauberes AdminFlags-Objekt.
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

// Cache eines Tenants verwerfen (nach Billing-/Plan-Änderungen aufrufen).
export function invalidateTenantFlags(tenantId: string): void {
  cache.delete(tenantId);
}

// 30-Sekunden-Cache pro Tenant (Lastspitzen abfedern, Änderungen zeitnah wirksam).
const cache = new Map<string, { flags: AdminFlags; at: number }>();
const CACHE_MS = 30_000;

// ROH: der Betreiber-Override (tenant.status + entitlements-Zeile) — für die
// Admin-Konsole zum Anzeigen/Bearbeiten. KEINE Abo-/Plan-Verrechnung.
export async function getRawEntitlements(tenantId: string): Promise<AdminFlags> {
  try {
    const rows = await db
      .select({
        status: tenants.status,
        modules: entitlements.modules,
        aiEnabled: entitlements.aiEnabled,
        aiMonthlyLimit: entitlements.aiMonthlyLimit,
        banner: entitlements.banner,
        updatedAt: entitlements.updatedAt,
      })
      .from(tenants)
      .leftJoin(entitlements, eq(entitlements.tenantId, tenants.id))
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const row = rows[0];
    if (!row) return DEFAULT_FLAGS;
    return {
      modules: (row.modules as Partial<Record<ModuleKey, boolean>>) ?? {},
      ai: { enabled: row.aiEnabled ?? true, monthlyLimit: row.aiMonthlyLimit ?? 0 },
      status: (row.status as AdminStatus) ?? "active",
      banner: row.banner ?? "",
      updatedAt: row.updatedAt ? new Date(row.updatedAt).getTime() : 0,
    };
  } catch {
    return DEFAULT_FLAGS;
  }
}

// EFFEKTIV: Override + Abo-Status + Plan verrechnet. Quelle für guardFeature und
// die Client-Flags. 30-s-Cache pro Tenant.
export async function getEntitlements(tenantId: string): Promise<AdminFlags> {
  const now = Date.now();
  const c = cache.get(tenantId);
  if (c && now - c.at < CACHE_MS) return c.flags;

  try {
    const rows = await db
      .select({
        status: tenants.status,
        plan: tenants.plan,
        sub: tenants.subscriptionStatus,
        trialEndsAt: tenants.trialEndsAt,
        modules: entitlements.modules,
        aiEnabled: entitlements.aiEnabled,
        aiMonthlyLimit: entitlements.aiMonthlyLimit,
        banner: entitlements.banner,
        updatedAt: entitlements.updatedAt,
      })
      .from(tenants)
      .leftJoin(entitlements, eq(entitlements.tenantId, tenants.id))
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const row = rows[0];
    if (!row) return DEFAULT_FLAGS;

    const adminStatus = (row.status as AdminStatus) ?? "active";
    const sub = row.sub || "trialing";
    const trialExpired = sub === "trialing" && !!row.trialEndsAt && new Date(row.trialEndsAt).getTime() < now;

    // Effektiver Status: Admin-Sperre > Abo-Ende/Trial abgelaufen > Admin-Nur-Lese > aktiv
    let status: AdminStatus = "active";
    let billingBanner = "";
    if (adminStatus === "locked") {
      status = "locked";
    } else if (sub === "canceled" || trialExpired) {
      status = "readonly";
      billingBanner = trialExpired
        ? "Deine Testphase ist abgelaufen — wähle einen Plan, um weiter zu erstellen."
        : "Dein Abo ist beendet — reaktiviere es, um weiter zu erstellen.";
    } else if (adminStatus === "readonly") {
      status = "readonly";
    } else if (sub === "past_due") {
      billingBanner = "Zahlung ausständig — bitte aktualisiere deine Zahlungsdaten.";
    }

    // KI-Kontingent: Admin-Override (>0) gewinnt, sonst das Kontingent des Plans.
    const override = row.aiMonthlyLimit ?? 0;
    const monthlyLimit = override > 0 ? override : planAiLimit(row.plan || "starter");

    const flags: AdminFlags = {
      modules: (row.modules as Partial<Record<ModuleKey, boolean>>) ?? {},
      ai: { enabled: row.aiEnabled ?? true, monthlyLimit },
      status,
      banner: (row.banner || "") || billingBanner,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).getTime() : 0,
    };
    cache.set(tenantId, { flags, at: now });
    return flags;
  } catch {
    return DEFAULT_FLAGS; // fail-open
  }
}

export async function setEntitlements(tenantId: string, flags: AdminFlags): Promise<void> {
  const now = new Date();
  await db.update(tenants).set({ status: flags.status }).where(eq(tenants.id, tenantId));
  await db
    .insert(entitlements)
    .values({
      tenantId,
      modules: flags.modules,
      aiEnabled: flags.ai.enabled,
      aiMonthlyLimit: flags.ai.monthlyLimit,
      banner: flags.banner,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: entitlements.tenantId,
      set: {
        modules: flags.modules,
        aiEnabled: flags.ai.enabled,
        aiMonthlyLimit: flags.ai.monthlyLimit,
        banner: flags.banner,
        updatedAt: now,
      },
    });
  cache.delete(tenantId);
}

export type TenantRow = { id: string; slug: string; name: string; plan: string; status: string };
export async function listTenants(): Promise<TenantRow[]> {
  try {
    return await db
      .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, plan: tenants.plan, status: tenants.status })
      .from(tenants)
      .orderBy(tenants.createdAt);
  } catch {
    return [];
  }
}

// ── KI-Verbrauch pro Tenant/Monat (Postgres) ─────────────
export function usageMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export async function getAiUsage(tenantId: string, month = usageMonth()): Promise<number> {
  try {
    const rows = await db
      .select({ aiCalls: usage.aiCalls })
      .from(usage)
      .where(and(eq(usage.tenantId, tenantId), eq(usage.month, month)))
      .limit(1);
    return rows[0]?.aiCalls ?? 0;
  } catch {
    return 0;
  }
}

export async function incrAiUsage(tenantId: string): Promise<void> {
  const month = usageMonth();
  try {
    await db
      .insert(usage)
      .values({ tenantId, month, aiCalls: 1 })
      .onConflictDoUpdate({
        target: [usage.tenantId, usage.month],
        set: { aiCalls: sql`${usage.aiCalls} + 1` },
      });
  } catch { /* Zählen ist Best-Effort, darf die KI-Antwort nie blockieren */ }
}

// ── Enforcement ──────────────────────────────────────────
// Nach dem Auth-Check aufrufen, mit der tenantId aus der Session.
function blocked(reason: string, message: string): Response {
  return Response.json({ error: message, blocked: true, reason }, { status: 403 });
}

export async function guardFeature(
  tenantId: string,
  opts: { module?: ModuleKey; ai?: boolean; write?: boolean },
): Promise<Response | null> {
  const flags = await getEntitlements(tenantId);

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
      const used = await getAiUsage(tenantId);
      if (used >= flags.ai.monthlyLimit) {
        return blocked("ai_limit", "Das KI-Kontingent für diesen Monat ist aufgebraucht.");
      }
    }
  }
  return null;
}
