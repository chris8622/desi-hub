"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import LoginGate from "@/components/LoginGate";

type PlannerItem = { id: string; date: string; channel: string; title: string; status: string };
type Draft = { id: string; title: string; content: string; channel: string; savedAt: string };
type Subscriber = { id: string; name: string; email: string; addedAt: string };

function getLS<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const CHANNEL_COLOR: Record<string, string> = {
  Instagram: "var(--accent)",
  Blog: "var(--sage)",
  Newsletter: "var(--gold)",
  Sonstiges: "var(--muted)",
};

export default function DashboardPage() {
  const [planner, setPlanner] = useState<PlannerItem[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [lastResearch, setLastResearch] = useState<string>("—");
  const [today, setToday] = useState("");
  const [greeting, setGreeting] = useState("Guten Tag");
  const [missingGroqKey, setMissingGroqKey] = useState(false);

  useEffect(() => {
    setPlanner(getLS<PlannerItem[]>("dh_planner", []));
    setDrafts(getLS<Draft[]>("dh_drafts", []));
    setSubscribers(getLS<Subscriber[]>("dh_subscribers", []));

    const history = getLS<{ query: string; date: string }[]>("dh_research_history", []);
    if (history.length > 0) {
      setLastResearch(new Date(history[history.length - 1].date).toLocaleDateString("de-AT"));
    }

    // Time-based greeting
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend");
    setToday(now.toLocaleDateString("de-AT", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));

    // Check if Groq key is set
    const groqKey = getLS<{ groq_key?: string }>("dh_settings", {}).groq_key;
    setMissingGroqKey(!groqKey);
  }, []);

  const thisWeek = (() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return planner.filter(p => {
      const d = new Date(p.date);
      return d >= start && d <= end;
    }).length;
  })();

  const upcoming = planner
    .filter(p => new Date(p.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const QUICK_ACTIONS = [
    { href: "/research", icon: "🔍", label: "Neue Research starten", desc: "Themen recherchieren & Quellen finden" },
    { href: "/content", icon: "💡", label: "Content erstellen", desc: "Karussell, Ideen & Captions generieren" },
    { href: "/editor", icon: "✍️", label: "Blog schreiben", desc: "Markdown-Editor mit Live-Vorschau" },
    { href: "/planner", icon: "📅", label: "Post einplanen", desc: "Wochenübersicht & Redaktionsplan" },
  ];

  return (
    <LoginGate>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          {greeting}, Desi 🌿
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{today}</p>
      </div>

      {/* Onboarding banner — shown when no Groq key is set */}
      {missingGroqKey && (
        <div style={{background:"var(--gold-light)", border:"1px solid rgba(184,148,80,0.35)", borderRadius:"var(--radius)", padding:"1rem 1.25rem", marginBottom:"1.5rem", display:"flex", alignItems:"center", gap:"1rem"}}>
          <span style={{fontSize:"1.5rem"}}>⚙️</span>
          <div style={{flex:1}}>
            <strong style={{fontSize:"0.9rem", color:"var(--gold)"}}>Einrichtung erforderlich</strong>
            <p style={{fontSize:"0.8rem", color:"var(--muted)", marginTop:"0.15rem"}}>Trage deinen kostenlosen Groq API Key ein um alle KI-Funktionen zu nutzen.</p>
          </div>
          <Link href="/settings" style={{background:"var(--gold)", color:"white", borderRadius:"var(--radius-sm)", padding:"0.5rem 1rem", textDecoration:"none", fontSize:"0.82rem", fontWeight:700, whiteSpace:"nowrap"}}>
            Jetzt einrichten →
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Diese Woche geplant", value: thisWeek, icon: "📅", color: "var(--accent)" },
          { label: "Drafts", value: drafts.length, icon: "✍️", color: "var(--sage)" },
          { label: "Subscriber", value: subscribers.length, icon: "📧", color: "var(--gold)" },
          { label: "Letzte Research", value: lastResearch, icon: "🔍", color: "var(--muted)" },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{stat.icon}</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: stat.color, lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.25rem" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: "2rem" }}>
        <div className="section-label">Schnellstart</div>
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
          {QUICK_ACTIONS.map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration: "none" }}>
              <div className="card" style={{
                padding: "1.4rem 1.5rem",
                cursor: "pointer",
                transition: "box-shadow 0.15s, transform 0.15s",
                display: "flex", alignItems: "flex-start", gap: "1rem",
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "";
                (e.currentTarget as HTMLElement).style.transform = "";
              }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "var(--radius-sm)",
                  background: "var(--accent-light)", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0,
                }}>
                  {a.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.2rem" }}>{a.label}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{a.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Upcoming posts */}
      <div>
        <div className="flex-between" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Nächste Posts</div>
          <Link href="/planner" style={{ fontSize: "0.82rem", color: "var(--accent)", textDecoration: "none" }}>
            Zum Planer →
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
            <div>Noch nichts geplant</div>
            <Link href="/planner" style={{ color: "var(--accent)", fontSize: "0.85rem", textDecoration: "none" }}>
              Zum Planer →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {upcoming.map(item => (
              <div key={item.id} className="card-sm" style={{
                display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: CHANNEL_COLOR[item.channel] || "var(--muted)",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {new Date(item.date).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}{item.channel}
                  </div>
                </div>
                <span className={`badge badge-${item.channel === "Instagram" ? "terra" : item.channel === "Blog" ? "sage" : item.channel === "Newsletter" ? "gold" : "muted"}`} style={{ fontSize: "0.72rem" }}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </LoginGate>
  );
}
