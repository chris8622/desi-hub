// ─── Admin-Auth + Audit-Log (Stufe-1-Konsole) ────────────
// Der Admin-Zugang ist bewusst vom Kunden-Login getrennt: eigenes
// ADMIN_PASSWORD (eigene Env-Var), NIE das APP_PASSWORD der Kundin.
// Ein Admin-Zugang ist das wertvollste Angriffsziel.

import { safeEqual } from "./server-auth";
import { getKvConfig, kvGet, kvSet } from "./kv";

// FAIL-CLOSED: Ohne ADMIN_PASSWORD ist die Konsole komplett gesperrt
// (nicht etwa offen). Header: x-admin-token.
export function requireAdmin(req: Request): Response | null {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return Response.json(
      { error: "Admin-Konsole nicht konfiguriert (ADMIN_PASSWORD fehlt)." },
      { status: 503 },
    );
  }
  const token = req.headers.get("x-admin-token") || "";
  if (!safeEqual(token, adminPassword)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ── Audit-Log light ──────────────────────────────────────
// Jede Admin-Aktion als Zeile in KV (wer/wann/was) — dasselbe Muster wie
// das bestehende Login-Log. Aufbewahrung: die letzten 200 Einträge.
export const AUDIT_KEY = "admin_audit_log_v1";
const AUDIT_KEEP = 200;

export type AuditEntry = { ts: number; action: string; detail: string; ip: string };

export async function writeAudit(req: Request, action: string, detail = ""): Promise<void> {
  const cfg = getKvConfig();
  if (!cfg) return;
  try {
    const raw = (await kvGet(cfg, AUDIT_KEY)) as AuditEntry[] | null;
    const entries = Array.isArray(raw) ? raw : [];
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "unknown";
    entries.unshift({ ts: Date.now(), action, detail: detail.slice(0, 200), ip });
    await kvSet(cfg, AUDIT_KEY, entries.slice(0, AUDIT_KEEP));
  } catch { /* Audit ist Best-Effort, darf die Aktion nicht blockieren */ }
}

export async function getAudit(): Promise<AuditEntry[]> {
  const cfg = getKvConfig();
  if (!cfg) return [];
  try {
    const raw = (await kvGet(cfg, AUDIT_KEY)) as AuditEntry[] | null;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
