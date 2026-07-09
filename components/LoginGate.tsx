"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import { syncDown, syncUp, flushOnHide } from "@/lib/sync";
import { apiFetch } from "@/lib/api";

type ClientFlags = { modules: Record<string, boolean>; banner: string; status: string };
type SyncUi = "idle" | "syncing" | "synced" | "local" | "error";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession(); // "loading" | "authenticated" | "unauthenticated"
  const authed = status === "authenticated";
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncUi>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [kvAvailable, setKvAvailable] = useState(false);
  const [conflictNote, setConflictNote] = useState(false);
  const [flags, setFlags] = useState<ClientFlags | null>(null);
  const didInitialSync = useRef(false);

  // Admin-Konsole und Auth.js-Login laufen an diesem Gate vorbei.
  const isBypass = pathname?.startsWith("/admin") || pathname?.startsWith("/login")
    || pathname?.startsWith("/forgot") || pathname?.startsWith("/reset");

  // Live-Sync-Status aus lib/sync (Hintergrund-Uploads beim Tippen)
  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail as { status: SyncUi; message?: string };
      if (!detail) return;
      setSyncStatus(detail.status);
      setSyncMessage(detail.message || "");
      if (detail.status === "synced") setKvAvailable(true);
      if (detail.status === "local") setKvAvailable(false);
    };
    window.addEventListener("desi-sync", onSync);
    return () => window.removeEventListener("desi-sync", onSync);
  }, []);

  // Beim Verlassen/Verstecken der Seite ausstehende Änderungen retten
  useEffect(() => {
    if (!authed) return;
    const onHide = () => { if (document.visibilityState === "hidden") flushOnHide(); };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushOnHide);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushOnHide);
    };
  }, [authed]);

  // Nach einem Sync-Konflikt (Reload durch lib/sync) einmalig einen Hinweis zeigen
  useEffect(() => {
    try {
      if (sessionStorage.getItem("desi_sync_conflict") === "1") {
        sessionStorage.removeItem("desi_sync_conflict");
        setConflictNote(true);
        setTimeout(() => setConflictNote(false), 6000);
      }
    } catch {}
  }, []);

  // Einmalige Migration: früher im Browser gespeicherte API-Keys entfernen —
  // KI läuft ausschließlich serverseitig (Sicherheit).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dh_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (("groq_key" in parsed) || ("perplexity_key" in parsed))) {
          delete parsed.groq_key;
          delete parsed.perplexity_key;
          localStorage.setItem("dh_settings", JSON.stringify(parsed));
        }
      }
    } catch {}
  }, []);

  // Sobald authentifiziert: einmalig Server-Stand laden + Flags holen.
  useEffect(() => {
    if (!authed || didInitialSync.current) return;
    didInitialSync.current = true;
    setSyncStatus("syncing");
    syncDown()
      .then(({ available }) => {
        setKvAvailable(available);
        setSyncStatus(available ? "synced" : "local");
      })
      .catch(() => setSyncStatus("local"));
    apiFetch<ClientFlags>("/api/flags").then(setFlags).catch(() => {});
  }, [authed]);

  // Nicht eingeloggt → zum echten Login (außer auf Bypass-Pfaden).
  useEffect(() => {
    if (isBypass) return;
    if (status === "unauthenticated") window.location.href = "/login";
  }, [status, isBypass]);

  const handleManualSync = async () => {
    setSyncStatus("syncing");
    await syncUp();
    const { available } = await syncDown();
    setKvAvailable(available);
    setSyncStatus(available ? "synced" : "local");
  };

  const handleLogout = () => { signOut({ redirectTo: "/login" }); };

  // Bypass-Pfade rendern ihr eigenes Gate.
  if (isBypass) return <>{children}</>;

  // Während des Ladens oder solange die Weiterleitung zum Login läuft.
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg)",
      }}>
        <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Laden…</div>
      </div>
    );
  }

  // Zentraler Modul-Guard: gesperrtes Modul → Hinweis statt Tool.
  const moduleKey = pathname && pathname !== "/" ? pathname.split("/")[1] : "";
  const lockedModule = !!(flags && moduleKey && flags.modules[moduleKey] === false);

  return (
    <div className="app-layout">
      {conflictNote && (
        <div style={{
          position: "fixed", top: "1rem", left: "50%", transform: "translateX(-50%)",
          zIndex: 300, background: "var(--surface)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--gold)", borderRadius: "var(--radius-sm)",
          boxShadow: "var(--shadow-md)", padding: "0.75rem 1.1rem", maxWidth: 420,
          fontSize: "0.82rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.6rem",
        }}>
          <span style={{ fontSize: "1.1rem" }}>🔄</span>
          Daten wurden von einem anderen Gerät aktualisiert und neu geladen.
        </div>
      )}
      <div
        className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        onLogout={handleLogout}
        open={sidebarOpen}
        hidden={flags ? Object.keys(flags.modules).filter(k => !flags.modules[k]) : []}
      />
      <div className="main-wrapper">
        {/* Mobile sticky header */}
        <div className="mobile-topbar">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menü öffnen"
          >
            ☰
          </button>
          <span className="mobile-topbar-logo">Raumo</span>
          <div style={{ width: 40 }} />
        </div>
        <main className="main-content">
        {flags && (flags.banner || flags.status !== "active") && (
          <div style={{
            marginBottom: "1.5rem",
            padding: "0.85rem 1.1rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            borderLeft: `3px solid ${flags.status === "locked" ? "var(--warm-red)" : flags.status === "readonly" ? "var(--gold)" : "var(--accent)"}`,
            background: flags.status === "locked" ? "var(--warm-red-light)" : flags.status === "readonly" ? "var(--gold-light)" : "var(--accent-light)",
            fontSize: "0.85rem", color: "var(--text)",
            display: "flex", alignItems: "center", gap: "0.6rem",
          }}>
            <span style={{ fontSize: "1.05rem", flexShrink: 0 }}>
              {flags.status === "locked" ? "🔒" : flags.status === "readonly" ? "👁️" : "📣"}
            </span>
            <span>
              {flags.status === "locked" && <strong>Instanz gesperrt. </strong>}
              {flags.status === "readonly" && <strong>Nur-Lese-Modus — Änderungen sind derzeit deaktiviert. </strong>}
              {flags.banner}
            </span>
          </div>
        )}
        {lockedModule ? (
          <div className="card" style={{ maxWidth: 460, margin: "3rem auto", textAlign: "center", padding: "2.5rem 2rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔒</div>
            <h2 style={{ marginBottom: "0.5rem" }}>Bereich nicht freigeschaltet</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
              Dieser Bereich ist für deine Instanz derzeit nicht aktiv.
            </p>
            <a href="/" className="btn btn-primary" style={{ textDecoration: "none" }}>Zum Dashboard</a>
          </div>
        ) : children}
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
            {syncStatus === "error" && (
              <button onClick={handleManualSync} title={syncMessage || "Erneut versuchen"}
                style={{ fontSize: "0.72rem", color: "var(--warm-red)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", padding: 0, fontWeight: 600 }}>
                ⚠️ Sync fehlgeschlagen{syncMessage ? ` — ${syncMessage}` : ""} · erneut versuchen
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
    </div>
  );
}
