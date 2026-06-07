"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { syncDown, syncUp } from "@/lib/sync";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle"|"syncing"|"synced"|"local">("idle");
  const [kvAvailable, setKvAvailable] = useState(false);

  useEffect(() => {
    try {
      const val = typeof window !== "undefined" ? localStorage.getItem("desi_auth") : null;
      if (val === "1") {
        setAuthed(true);
        // Beim App-Start: Daten vom Server laden
        setSyncStatus("syncing");
        syncDown().then(({ available }) => {
          setKvAvailable(available);
          setSyncStatus(available ? "synced" : "local");
        });
      } else {
        setAuthed(false);
      }
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
          localStorage.setItem("desi_auth_token", password);
        } catch {}
        // Daten vom Server laden nach Login
        setSyncStatus("syncing");
        const { available } = await syncDown();
        setKvAvailable(available);
        setSyncStatus(available ? "synced" : "local");
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

  // Manueller Sync
  const handleManualSync = async () => {
    setSyncStatus("syncing");
    await syncUp();
    const { available } = await syncDown();
    setKvAvailable(available);
    setSyncStatus(available ? "synced" : "local");
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
          <p style={{ color: "var(--border)", fontSize: "0.7rem", marginTop: "1rem" }}>
            made with ❤️ by{" "}
            <a href="https://toelsner.at" target="_blank" rel="noopener"
              style={{ color: "var(--muted)", textDecoration: "none" }}>
              Toelsner Digital
            </a>
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
          style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 60, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.7rem', boxShadow: 'var(--shadow)' }}
        >
          ☰
        </button>
        {children}
        <footer style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          {/* Sync-Status */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {syncStatus === "syncing" && (
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", animation: "pulse 1.2s infinite", display: "inline-block" }} />
                Synchronisiere…
              </span>
            )}
            {syncStatus === "synced" && (
              <button onClick={handleManualSync} title="Jetzt synchronisieren"
                style={{ fontSize: "0.72rem", color: "var(--sage)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", padding: 0 }}>
                ☁️ Cloud-Sync aktiv
              </button>
            )}
            {syncStatus === "local" && (
              <button onClick={handleManualSync} title="KV nicht verfügbar — lokal gespeichert"
                style={{ fontSize: "0.72rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", padding: 0 }}>
                💾 Nur lokal gespeichert
              </button>
            )}
            {/* KV nicht konfiguriert — Hinweis */}
            {syncStatus === "local" && !kvAvailable && (
              <a href="/settings#sync" style={{ fontSize: "0.68rem", color: "var(--accent)", textDecoration: "underline" }}>
                Cross-Device Sync einrichten →
              </a>
            )}
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            made with ❤️ by{" "}
            <a href="https://toelsner.at" target="_blank" rel="noopener"
              style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
              Toelsner Digital
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
