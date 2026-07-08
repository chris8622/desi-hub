"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

// Echter Login (Auth.js). Läuft via Sonderfall in LoginGate am alten
// APP_PASSWORD-Gate vorbei. Im Cutover-Increment wird dies das einzige Gate.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("E-Mail oder Passwort stimmt nicht.");
    else window.location.href = "/";
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: "2.5rem 2rem", textAlign: "center" }}>
        <div style={{ width: 48, height: 4, borderRadius: 2, background: "var(--accent)", margin: "0 auto 1.75rem" }} />
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2.2rem", color: "var(--accent)", marginBottom: "0.35rem", lineHeight: 1.15 }}>
          Contentraum
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: "2rem" }}>Wo Ideen Raum finden</p>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ textAlign: "left" }}>
            <label className="label" htmlFor="email">E-Mail</label>
            <input id="email" className="input" type="email" value={email} autoComplete="username"
              onChange={e => setEmail(e.target.value)} placeholder="du@beispiel.at" autoFocus style={{ width: "100%" }} />
          </div>
          <div style={{ textAlign: "left" }}>
            <label className="label" htmlFor="password">Passwort</label>
            <input id="password" className="input" type="password" value={password} autoComplete="current-password"
              onChange={e => setPassword(e.target.value)} placeholder="Passwort eingeben…" style={{ width: "100%" }} />
          </div>
          {error && <div className="alert alert-error" style={{ textAlign: "left" }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading || !email || !password}
            style={{ width: "100%", justifyContent: "center", marginTop: "0.25rem" }}>
            {loading ? "Anmelden…" : "Einloggen"}
          </button>
        </form>

        <p style={{ color: "var(--border)", fontSize: "0.7rem", marginTop: "2rem" }}>
          made with ❤️ by{" "}
          <a href="https://toelsner.at" target="_blank" rel="noopener" style={{ color: "var(--muted)", textDecoration: "none" }}>
            Toelsner Digital
          </a>
        </p>
      </div>
    </div>
  );
}
