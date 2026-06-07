"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",          icon: "🏠", label: "Dashboard"     },
  { href: "/ideen",     icon: "🌱", label: "Ideen-Pool"   },
  { href: "/research",  icon: "🔍", label: "Research"      },
  { href: "/trends",    icon: "📈", label: "Trend-Radar"   },
  { href: "/content",   icon: "💡", label: "Content"       },
  { href: "/editor",    icon: "✍️",  label: "Editor"       },
  { href: "/planner",   icon: "📅", label: "Planer"        },
  { href: "/email",     icon: "📧", label: "E-Mail"        },
  { href: "/settings",  icon: "⚙️", label: "Einstellungen" },
];

export default function Sidebar({ onLogout, open }: { onLogout: () => void; open?: boolean }) {
  const path = usePathname();
  return (
    <aside className={open ? "open" : undefined} style={{
      position: "fixed", top: 0, left: 0, bottom: 0,
      width: "var(--sidebar-w)", background: "var(--surface)",
      borderRight: "1px solid var(--border)", display: "flex",
      flexDirection: "column", zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", color: "var(--accent)" }}>
          Desi Hub
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.15rem" }}>Content Workspace</div>
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
  );
}
