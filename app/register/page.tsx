"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { PLANS, PLAN_IDS, DEFAULT_PLAN, type PlanId } from "@/lib/plans";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<PlanId>(DEFAULT_PLAN);
  const [agb, setAgb] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agb) { setError("Bitte AGB und Datenschutz akzeptieren."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, plan, agb }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Registrierung fehlgeschlagen."); setLoading(false); return; }
      // direkt einloggen
      const r = await signIn("credentials", { email, password, redirect: false });
      if (r?.error) { window.location.href = "/login"; return; }
      window.location.href = "/";
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div className="card" style={{ width: "100%", maxWidth: 560, padding: "2.5rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ width: 48, height: 4, borderRadius: 2, background: "var(--accent)", margin: "0 auto 1.25rem" }} />
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent)", marginBottom: "0.25rem" }}>Konto erstellen</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>14 Tage kostenlos testen · keine Zahlung beim Start</p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name" style={{ width: "100%" }} />
          </div>
          <div>
            <label className="label" htmlFor="email">E-Mail</label>
            <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="du@beispiel.at" style={{ width: "100%" }} />
          </div>
          <div>
            <label className="label" htmlFor="password">Passwort</label>
            <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="mind. 8 Zeichen" style={{ width: "100%" }} />
          </div>

          <div>
            <label className="label">Plan wählen (im Test unverbindlich)</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {PLAN_IDS.map(id => {
                const p = PLANS[id];
                const on = plan === id;
                return (
                  <button type="button" key={id} onClick={() => setPlan(id)}
                    style={{
                      padding: "0.75rem 0.6rem", borderRadius: "var(--radius-sm)", cursor: "pointer", textAlign: "left",
                      border: on ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: on ? "var(--accent-light)" : "var(--surface2)",
                    }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>{p.name}</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent2)" }}>{p.monthly} €<span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 400 }}>/Mon</span></div>
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                      {p.aiMonthlyLimit === 0 ? "KI unbegrenzt" : `${p.aiMonthlyLimit} KI/Mon`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
            <input type="checkbox" checked={agb} onChange={e => setAgb(e.target.checked)} style={{ marginTop: "0.2rem" }} />
            <span>Ich akzeptiere die <a href="/agb" target="_blank" style={{ color: "var(--accent)" }}>AGB</a> und die <a href="/datenschutz" target="_blank" style={{ color: "var(--accent)" }}>Datenschutzerklärung</a>.</span>
          </label>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading || !email || !password || !agb}
            style={{ width: "100%", justifyContent: "center" }}>
            {loading ? "Konto wird erstellt…" : "Kostenlos starten"}
          </button>
          <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
            Schon ein Konto? <a href="/login" style={{ color: "var(--accent)" }}>Anmelden</a>
          </p>
        </form>
      </div>
    </div>
  );
}
