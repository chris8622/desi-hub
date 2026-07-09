"use client";
import { useState } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setLoading(false);
    setSent(true);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: "2.5rem 2rem", textAlign: "center" }}>
        <div style={{ width: 48, height: 4, borderRadius: 2, background: "var(--accent)", margin: "0 auto 1.75rem" }} />
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", color: "var(--accent)", marginBottom: "0.35rem" }}>Passwort vergessen?</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "2rem" }}>Wir schicken dir einen Link zum Zurücksetzen.</p>

        {sent ? (
          <>
            <div className="alert alert-success" style={{ textAlign: "left", marginBottom: "1.5rem" }}>
              Falls ein Konto mit dieser E-Mail existiert, ist ein Link unterwegs. Schau in dein Postfach (auch Spam).
            </div>
            <a href="/login" className="btn btn-secondary" style={{ textDecoration: "none" }}>Zurück zum Login</a>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "left" }}>
              <label className="label" htmlFor="email">E-Mail</label>
              <input id="email" className="input" type="email" value={email} autoComplete="username"
                onChange={e => setEmail(e.target.value)} placeholder="du@beispiel.at" autoFocus style={{ width: "100%" }} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading || !email} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Sende…" : "Link anfordern"}
            </button>
            <a href="/login" style={{ fontSize: "0.8rem", color: "var(--muted)", textDecoration: "none" }}>Zurück zum Login</a>
          </form>
        )}
      </div>
    </div>
  );
}
