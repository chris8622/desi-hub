"use client";
import { useState, useEffect, useCallback } from "react";

// ─── Admin-Konsole (Stufe 1, multi-tenant) ───────────────
// Eigener Admin-Login (ADMIN_PASSWORD). Wählt einen Mandanten und steuert dessen
// Entitlements/Daten in Postgres. Läuft via LoginGate-Bypass am Kunden-Login vorbei.

const TOKEN_KEY = "dh_admin_token";

const MODULES: { key: string; label: string }[] = [
  { key: "ideen", label: "Ideen-Pool" }, { key: "research", label: "Research" },
  { key: "trends", label: "Trend-Radar" }, { key: "content", label: "Content" },
  { key: "editor", label: "Editor" }, { key: "repurpose", label: "Repurpose" },
  { key: "hashtags", label: "Hashtags" }, { key: "captions", label: "Caption-Bank" },
  { key: "vision", label: "Mein Northstar" }, { key: "planner", label: "Planer" },
  { key: "email", label: "E-Mail" }, { key: "analytics", label: "Analytics" },
];

type Flags = {
  modules: Record<string, boolean>;
  ai: { enabled: boolean; monthlyLimit: number };
  status: "active" | "readonly" | "locked";
  banner: string;
  updatedAt: number;
};
type Tenant = { id: string; slug: string; name: string; plan: string; status: string };
type Backup = { id: string; label: string; createdAt: number };
type Status = { month: string; aiUsage: number; dataBytes: number; updatedAt: number; backups: Backup[] };
type AuditEntry = { ts: number; action: string; detail: string; ip: string };

async function adminFetch<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "x-admin-token": token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `Fehler ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
function fmtTs(ts: number): string {
  if (!ts) return "–";
  return new Date(ts).toLocaleString("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
const ACTION_LABELS: Record<string, string> = {
  flags_update: "Flags geändert", data_reset: "Daten geleert", data_restore: "Backup eingespielt",
  invite: "Nutzer eingeladen",
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [loginError, setLoginError] = useState("");
  const [checking, setChecking] = useState(true);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [flags, setFlags] = useState<Flags | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [restoreId, setRestoreId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLink, setInviteLink] = useState("");

  const loadForTenant = useCallback(async (t: string, tenantId: string) => {
    const [f, s] = await Promise.all([
      adminFetch<{ flags: Flags }>(`/api/admin/flags?tenantId=${tenantId}`, t),
      adminFetch<Status>(`/api/admin/status?tenantId=${tenantId}`, t),
    ]);
    setFlags(f.flags);
    setStatus(s);
    setRestoreId("");
  }, []);

  const loadAll = useCallback(async (t: string, keepTenant?: string) => {
    const [tl, a] = await Promise.all([
      adminFetch<{ tenants: Tenant[] }>("/api/admin/tenants", t),
      adminFetch<{ entries: AuditEntry[] }>("/api/admin/audit", t),
    ]);
    setTenants(tl.tenants || []);
    setAudit(a.entries || []);
    const tenantId = keepTenant || tl.tenants?.[0]?.id || "";
    setSelected(tenantId);
    if (tenantId) await loadForTenant(t, tenantId);
  }, [loadForTenant]);

  const validate = useCallback(async (t: string) => {
    try {
      await loadAll(t);
      setToken(t);
      try { sessionStorage.setItem(TOKEN_KEY, t); } catch {}
    } catch {
      setToken(null);
      try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    } finally {
      setChecking(false);
    }
  }, [loadAll]);

  useEffect(() => {
    let t: string | null = null;
    try { t = sessionStorage.getItem(TOKEN_KEY); } catch {}
    if (t) validate(t); else setChecking(false);
  }, [validate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setChecking(true);
    try {
      await loadAll(pw);
      setToken(pw);
      try { sessionStorage.setItem(TOKEN_KEY, pw); } catch {}
      setPw("");
    } catch (err) {
      setLoginError((err as Error).message === "Unauthorized" ? "Falsches Admin-Passwort." : (err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const logout = () => {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    setToken(null); setFlags(null); setStatus(null); setAudit([]); setTenants([]); setSelected("");
  };

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const onSelectTenant = async (tenantId: string) => {
    if (!token) return;
    setSelected(tenantId);
    setFlags(null); setStatus(null);
    try { await loadForTenant(token, tenantId); }
    catch (err) { flash("err", (err as Error).message); }
  };

  const saveFlags = async () => {
    if (!flags || !token || !selected) return;
    setSaving(true);
    try {
      const modules: Record<string, boolean> = {};
      for (const m of MODULES) modules[m.key] = flags.modules[m.key] !== false;
      const payload: Flags = { ...flags, modules };
      const r = await adminFetch<{ flags: Flags }>("/api/admin/flags", token, { tenantId: selected, flags: payload });
      setFlags(r.flags);
      await loadForTenant(token, selected);
      await loadAll(token, selected).catch(() => {}); // Audit + Tenant-Status auffrischen
      flash("ok", "Entitlements gespeichert.");
    } catch (err) {
      flash("err", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doData = async (action: "reset" | "restore", backupId?: string) => {
    if (!token || !selected) return;
    const confirmText = action === "reset"
      ? "Wirklich ALLE Daten dieses Mandanten leeren? Ein Undo-Snapshot wird vorher gesichert."
      : "Dieses Backup einspielen? Der aktuelle Stand wird vorher als Undo-Snapshot gesichert.";
    if (!window.confirm(confirmText)) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/data", token, { tenantId: selected, action, backupId });
      await loadForTenant(token, selected);
      await loadAll(token, selected).catch(() => {});
      flash("ok", action === "reset" ? "Daten geleert (Undo gesichert)." : "Backup eingespielt.");
    } catch (err) {
      flash("err", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doInvite = async () => {
    if (!token || !selected || !inviteEmail.trim()) return;
    setSaving(true);
    setInviteLink("");
    try {
      const r = await adminFetch<{ emailed: boolean; link?: string }>(
        "/api/admin/invite", token, { tenantId: selected, email: inviteEmail.trim(), role: inviteRole },
      );
      setInviteEmail("");
      await loadAll(token, selected).catch(() => {});
      if (r.emailed) {
        flash("ok", "Einladung per E-Mail verschickt.");
      } else {
        setInviteLink(r.link || "");
        flash("ok", "Nutzer angelegt — Link unten weitergeben (kein E-Mail-Versand konfiguriert).");
      }
    } catch (err) {
      flash("err", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Login-Screen ───────────────────────────────────────
  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
        <div className="card" style={{ width: "100%", maxWidth: 420, padding: "2.5rem 2rem", textAlign: "center" }}>
          <div style={{ width: 48, height: 4, borderRadius: 2, background: "var(--accent)", margin: "0 auto 1.5rem" }} />
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", color: "var(--accent)", marginBottom: "0.35rem" }}>Admin-Konsole</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "2rem" }}>Betreiber-Zugang · Raumo</p>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "left" }}>
              <label className="label" htmlFor="admin-pw">Admin-Passwort</label>
              <input id="admin-pw" className="input" type="password" value={pw}
                onChange={e => setPw(e.target.value)} placeholder="Admin-Passwort…" autoFocus style={{ width: "100%" }} />
            </div>
            {loginError && <div className="alert alert-error" style={{ textAlign: "left" }}>{loginError}</div>}
            <button type="submit" className="btn btn-primary" disabled={checking || !pw} style={{ width: "100%", justifyContent: "center" }}>
              {checking ? "Prüfe…" : "Anmelden"}
            </button>
          </form>
          <p style={{ color: "var(--border)", fontSize: "0.7rem", marginTop: "2rem" }}>Getrennt vom Kunden-Login · nur für den Betreiber</p>
        </div>
      </div>
    );
  }

  const currentTenant = tenants.find(t => t.id === selected);

  // ── Konsole ────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", color: "var(--accent)" }}>Admin-Konsole</h1>
        <button onClick={logout} className="btn btn-ghost btn-sm">Abmelden</button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Betreiber-Steuerung · Entitlements & Daten liegen in Postgres · greift ohne Deploy (max. 30 s Cache).
      </p>

      {msg && (
        <div className={`alert ${msg.kind === "ok" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.25rem" }}>{msg.text}</div>
      )}

      {/* Mandanten-Auswahl */}
      <section className="card" style={{ marginBottom: "1.25rem" }}>
        <label className="label" htmlFor="tenant">Mandant ({tenants.length})</label>
        <select id="tenant" className="select" value={selected} onChange={e => onSelectTenant(e.target.value)} style={{ width: "100%" }}>
          {tenants.length === 0 && <option value="">— kein Mandant —</option>}
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.slug}) · {t.plan} · {t.status}</option>
          ))}
        </select>
      </section>

      {!selected && (
        <div className="alert alert-error">Kein Mandant vorhanden. Lege zuerst einen an (Seed / Registrierung).</div>
      )}

      {/* Status-Übersicht */}
      {status && (
        <section className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "0.85rem" }}>📊 Übersicht{currentTenant ? ` — ${currentTenant.name}` : ""}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.85rem" }}>
            {[
              { l: `KI-Aufrufe (${status.month})`, v: String(status.aiUsage) },
              { l: "Datengröße", v: fmtBytes(status.dataBytes) },
              { l: "Zuletzt geändert", v: fmtTs(status.updatedAt) },
              { l: "Backups", v: String(status.backups.length) },
            ].map((s, i) => (
              <div key={i} style={{ padding: "0.75rem 0.9rem", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.25rem" }}>{s.l}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>{s.v}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Flags-Editor */}
      {flags && selected && (
        <section className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>🎛️ Steuerung</h3>

          <div style={{ marginBottom: "1.25rem" }}>
            <label className="label">Instanz-Status</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {([
                { v: "active", l: "Aktiv", d: "Voller Zugriff" },
                { v: "readonly", l: "Nur-Lese", d: "Keine Änderungen / kein Sync-Upload" },
                { v: "locked", l: "Gesperrt", d: "Nur Login + Export" },
              ] as const).map(o => (
                <button key={o.v} onClick={() => setFlags({ ...flags, status: o.v })} title={o.d}
                  className={`btn btn-sm ${flags.status === o.v ? "btn-primary" : "btn-secondary"}`}>{o.l}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label className="label">KI-Funktionen</label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <button onClick={() => setFlags({ ...flags, ai: { ...flags.ai, enabled: !flags.ai.enabled } })}
                className={`btn btn-sm ${flags.ai.enabled ? "btn-primary" : "btn-secondary"}`}>
                {flags.ai.enabled ? "KI an" : "KI aus (Kill-Switch)"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Monatslimit</span>
                <input className="input" type="number" min={0} value={flags.ai.monthlyLimit}
                  onChange={e => setFlags({ ...flags, ai: { ...flags.ai, monthlyLimit: Math.max(0, Number(e.target.value) || 0) } })}
                  style={{ width: 100 }} />
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>0 = unbegrenzt</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label className="label">Module (aktiv = freigeschaltet)</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.4rem" }}>
              {MODULES.map(m => {
                const on = flags.modules[m.key] !== false;
                return (
                  <button key={m.key} onClick={() => setFlags({ ...flags, modules: { ...flags.modules, [m.key]: !on } })}
                    className="btn btn-sm"
                    style={{
                      justifyContent: "flex-start",
                      background: on ? "var(--sage-light)" : "var(--surface2)",
                      color: on ? "var(--sage)" : "var(--muted)",
                      border: `1px solid ${on ? "var(--sage)" : "var(--border)"}`,
                    }}>
                    {on ? "✓" : "🔒"} {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label className="label" htmlFor="banner">Ankündigungs-Banner (leer = aus)</label>
            <input id="banner" className="input" type="text" value={flags.banner} maxLength={280}
              onChange={e => setFlags({ ...flags, banner: e.target.value })}
              placeholder="z. B. Wartung heute 22–23 Uhr…" style={{ width: "100%" }} />
          </div>

          <button onClick={saveFlags} disabled={saving} className="btn btn-primary">
            {saving ? "Speichere…" : "Änderungen speichern"}
          </button>
          {flags.updatedAt > 0 && (
            <span style={{ marginLeft: "0.75rem", fontSize: "0.72rem", color: "var(--muted)" }}>
              zuletzt geändert: {fmtTs(flags.updatedAt)}
            </span>
          )}
        </section>
      )}

      {/* Daten */}
      {status && selected && (
        <section className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "0.85rem" }}>🗄️ Daten</h3>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label className="label" htmlFor="restore">Backup einspielen</label>
              <select id="restore" className="select" value={restoreId} onChange={e => setRestoreId(e.target.value)} style={{ minWidth: 240 }}>
                <option value="">— Backup wählen —</option>
                {status.backups.map(b => <option key={b.id} value={b.id}>{b.label} · {fmtTs(b.createdAt)}</option>)}
              </select>
            </div>
            <button className="btn btn-secondary" disabled={saving || !restoreId} onClick={() => doData("restore", restoreId)}>Einspielen</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" disabled={saving} onClick={() => doData("reset")}
              style={{ color: "var(--warm-red)", borderColor: "var(--warm-red)" }}>Daten leeren</button>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.75rem" }}>
            Jede destruktive Aktion sichert vorher automatisch einen Undo-Snapshot (die letzten 20 bleiben erhalten).
          </p>
        </section>
      )}

      {/* Nutzer einladen */}
      {selected && (
        <section className="card" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginBottom: "0.85rem" }}>👤 Nutzer einladen</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="label" htmlFor="invite-email">E-Mail</label>
              <input id="invite-email" className="input" type="email" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)} placeholder="neue-person@beispiel.at" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="label" htmlFor="invite-role">Rolle</label>
              <select id="invite-role" className="select" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                <option value="member">Mitglied</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <button className="btn btn-primary" disabled={saving || !inviteEmail.trim()} onClick={doInvite}>Einladen</button>
          </div>
          {inviteLink && (
            <div style={{ marginTop: "0.85rem", padding: "0.75rem", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.3rem" }}>Einladungs-Link (kein E-Mail-Versand — manuell weitergeben):</div>
              <code style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>{inviteLink}</code>
            </div>
          )}
          <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.75rem" }}>
            Die eingeladene Person setzt über den Link ihr eigenes Passwort (7 Tage gültig).
          </p>
        </section>
      )}

      {/* Audit-Log */}
      <section className="card">
        <h3 style={{ marginBottom: "0.85rem" }}>📜 Audit-Log <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "0.78rem" }}>({audit.length})</span></h3>
        {audit.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Noch keine Admin-Aktionen protokolliert.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 320, overflowY: "auto" }}>
            {audit.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "baseline", fontSize: "0.8rem", padding: "0.4rem 0.5rem", borderRadius: "var(--radius-sm)", background: i % 2 ? "transparent" : "var(--surface2)" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.72rem", flexShrink: 0, minWidth: 128 }}>{fmtTs(e.ts)}</span>
                <span style={{ fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>{ACTION_LABELS[e.action] || e.action}</span>
                <span style={{ color: "var(--muted)", flex: 1 }}>{e.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
