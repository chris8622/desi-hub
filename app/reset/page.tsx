"use client";
import { useState, useEffect } from "react";

export default function ResetPage() {
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setToken(p.get("token") || "");
    setInvite(p.get("invite") === "1");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { setError("Das Passwort muss mindestens 8 Zeichen haben."); return; }
    if (pw !== pw2) { setError("Die Passwörter stimmen nicht überein."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Es ist ein Fehler aufgetreten."); setLoading(false); return; }
      setDone(true);
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
    }
    setLoading(false);
  };

  const title = invite ? "Passwort festlegen" : "Neues Passwort";
  const sub = invite ? "Willkommen! Leg dein Passwort fest und starte." : "Wähle dein neues Passwort.";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: "2.5rem 2rem", textAlign: "center" }}>
        <div style={{ width: 48, height: 4, borderRadius: 2, background: "var(--accent)", margin: "0 auto 1.75rem" }} />
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", color: "var(--accent)", marginBottom: "0.35rem" }}>{title}</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "2rem" }}>{sub}</p>

        {done ? (
          <>
            <div className="alert alert-success" style={{ textAlign: "left", marginBottom: "1.5rem" }}>
              Passwort gespeichert. Du kannst dich jetzt anmelden.
            </div>
            <a href="/login" className="btn btn-primary" style={{ textDecoration: "none" }}>Zum Login</a>
          </>
        ) : token === "" ? (
          <div className="alert alert-error" style={{ textAlign: "left" }}>Dieser Link ist ungültig. Fordere über „Passwort vergessen?" einen neuen an.</div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "left" }}>
              <label className="label" htmlFor="pw">Neues Passwort</label>
              <input id="pw" className="input" type="password" value={pw} autoComplete="new-password"
                onChange={e => setPw(e.target.value)} placeholder="mind. 8 Zeichen" autoFocus style={{ width: "100%" }} />
            </div>
            <div style={{ textAlign: "left" }}>
              <label className="label" htmlFor="pw2">Wiederholen</label>
              <input id="pw2" className="input" type="password" value={pw2} autoComplete="new-password"
                onChange={e => setPw2(e.target.value)} placeholder="nochmal eingeben" style={{ width: "100%" }} />
            </div>
            {error && <div className="alert alert-error" style={{ textAlign: "left" }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading || !pw || !pw2} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Speichere…" : "Passwort speichern"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
