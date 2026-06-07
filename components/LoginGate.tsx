"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const val = typeof window !== "undefined" ? localStorage.getItem("desi_auth") : null;
      setAuthed(val === "1");
    } catch {
      setAuthed(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        try {
          localStorage.setItem("desi_auth", "1");
          localStorage.setItem("desi_auth_token", password); // store password as token for API auth
        } catch {}
        setAuthed(true);
      } else {
        setError("Falsches Passwort. Bitte nochmal versuchen.");
      }
    } catch {
      setError("Verbindungsfehler. Bitte Seite neu laden.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try { localStorage.removeItem("desi_auth"); } catch {}
    window.location.reload();
  };

  if (authed === null) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg)",
      }}>
        <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Laden…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg)",
        padding: "1.5rem",
      }}>
        <div className="card" style={{
          width: "100%", maxWidth: 420, padding: "2.5rem 2rem",
          boxShadow: "var(--shadow-md)", textAlign: "center",
        }}>
          {/* Decorative top accent */}
          <div style={{
            width: 48, height: 4, borderRadius: 2,
            background: "var(--accent)", margin: "0 auto 1.75rem",
          }} />

          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "2.2rem", color: "var(--accent)",
            marginBottom: "0.35rem", lineHeight: 1.15,
          }}>
            Desi Hub
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: "2rem" }}>
            Content Workspace
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ textAlign: "left" }}>
              <label className="label" htmlFor="pw-input">Passwort</label>
              <input
                id="pw-input"
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Passwort eingeben…"
                autoFocus
                style={{ width: "100%" }}
              />
            </div>

            {error && (
              <div className="alert alert-error" style={{ textAlign: "left" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !password}
              style={{ width: "100%", justifyContent: "center", marginTop: "0.25rem" }}
            >
              {loading ? "Anmelden…" : "Einloggen"}
            </button>
          </form>

          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "2rem" }}>
            🌿 Dein persönlicher Workspace
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div
        className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar onLogout={handleLogout} open={sidebarOpen} />
      <main className="main-content">
        <button
          className="hamburger"
          onClick={() => setSidebarOpen(true)}
          aria-label="Menü öffnen"
        >
          ☰
        </button>
        {children}
      </main>
    </div>
  );
}
