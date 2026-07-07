"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

const NAV = [
  { href: "/",           icon: "🏠", label: "Dashboard"     },
  { href: "/ideen",      icon: "🌱", label: "Ideen-Pool"   },
  { href: "/research",   icon: "🔍", label: "Research"      },
  { href: "/trends",     icon: "📈", label: "Trend-Radar"   },
  { href: "/content",    icon: "💡", label: "Content"       },
  { href: "/editor",     icon: "✍️",  label: "Editor"       },
  { href: "/repurpose",  icon: "♻️",  label: "Repurpose"    },
  { href: "/hashtags",   icon: "#️⃣",  label: "Hashtags"     },
  { href: "/captions",   icon: "✨",  label: "Caption-Bank" },
  { href: "/vision",     icon: "🌟", label: "Mein Northstar"},
  { href: "/planner",    icon: "📅", label: "Planer"        },
  { href: "/email",      icon: "📧", label: "E-Mail"        },
  { href: "/analytics",  icon: "📊", label: "Analytics"     },
  { href: "/settings",   icon: "⚙️", label: "Einstellungen" },
];

type LoginEntry = { ts: number; ip: string; device: string; success: boolean; city?: string; country?: string };

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function LoginLogModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<LoginEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("desi_auth_token");
    if (!token) { setError("Nicht eingeloggt."); return; }
    fetch("/api/admin/login-log", { headers: { "x-app-token": token } })
      .then(r => r.json())
      .then((d: { entries: LoginEntry[] }) => setEntries(d.entries || []))
      .catch(() => setError("Fehler beim Laden."));
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 480,
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        border: "1px solid var(--border)",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem 1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>🔐 Login-Aktivität</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.15rem" }}>
              Letzte {entries ? Math.min(entries.length, 25) : "…"} Anmeldeversuche
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem",
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem" }}>
          {error && (
            <div style={{ color: "var(--warm-red)", fontSize: "0.85rem", padding: "0.75rem 0" }}>{error}</div>
          )}

          {!error && entries === null && (
            <div style={{ color: "var(--muted)", fontSize: "0.85rem", padding: "0.75rem 0" }}>Lade…</div>
          )}

          {entries !== null && entries.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: "0.85rem", padding: "0.75rem 0" }}>
              Noch keine Login-Einträge gespeichert.
            </div>
          )}

          {entries !== null && entries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {entries.map((e, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: "0.75rem",
                  padding: "0.75rem 0.875rem",
                  borderRadius: "var(--radius-sm)",
                  background: e.success ? "var(--surface2)" : "rgba(220,38,38,0.06)",
                  border: `1px solid ${e.success ? "var(--border)" : "rgba(220,38,38,0.2)"}`,
                }}>
                  <div style={{ fontSize: "1.1rem", lineHeight: 1.3, flexShrink: 0 }}>
                    {e.success ? "✅" : "❌"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.15rem" }}>
                      {e.device}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <span>🕐 {formatTs(e.ts)}</span>
                      {(e.city || e.country) && (
                        <span>📍 {[e.city, e.country].filter(Boolean).join(", ")}</span>
                      )}
                      <span style={{ opacity: 0.6 }}>{e.ip}</span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: "0.68rem", fontWeight: 700, padding: "0.2rem 0.5rem",
                    borderRadius: "var(--radius-sm)",
                    background: e.success ? "rgba(var(--sage-rgb,88,129,87),0.12)" : "rgba(220,38,38,0.1)",
                    color: e.success ? "var(--sage)" : "#dc2626",
                    flexShrink: 0,
                  }}>
                    {e.success ? "OK" : "Fehler"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: "0.75rem 1.5rem",
          borderTop: "1px solid var(--border)",
          fontSize: "0.7rem", color: "var(--border)",
          textAlign: "center",
        }}>
          🤫 Easter Egg — only for you
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ onLogout, open }: { onLogout: () => void; open?: boolean }) {
  const path = usePathname();
  const [showLog, setShowLog] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = useCallback(() => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= 5) {
      clickCount.current = 0;
      setShowLog(true);
      return;
    }
    clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 2000);
  }, []);

  return (
    <>
      {showLog && <LoginLogModal onClose={() => setShowLog(false)} />}

      <aside className={open ? "open" : undefined} style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: "var(--sidebar-w)", background: "var(--surface)",
        borderRight: "1px solid var(--border)", display: "flex",
        flexDirection: "column", zIndex: 50,
      }}>
        {/* Logo — 5 Klicks → Easter Egg */}
        <div
          style={{ padding: "1.5rem 1.25rem 1rem", cursor: "default", userSelect: "none" }}
          onClick={handleLogoClick}
        >
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", color: "var(--accent)" }}>
            Contentraum
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.15rem" }}>Wo Ideen Raum finden</div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0 1.25rem 0.75rem" }} />

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "0 0.75rem", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          {NAV.map(item => {
            const active = path === item.href;
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: "0.65rem",
                padding: "0.6rem 0.75rem", borderRadius: "var(--radius-sm)",
                textDecoration: "none", fontSize: "0.88rem", fontWeight: active ? 600 : 400,
                color: active ? "var(--accent2)" : "var(--muted)",
                background: active ? "var(--accent-light)" : "transparent",
                transition: "all 0.15s",
              }}
              onMouseOver={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}}
              onMouseOut={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--muted)"; }}}
              >
                <span style={{ fontSize: "1.05rem" }}>{item.icon}</span>
                {item.label}
                {active && <span style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "var(--accent)" }} />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
          <button onClick={onLogout} className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }}>
            Abmelden
          </button>
        </div>
      </aside>
    </>
  );
}
