"use client";
import { PLANS, PLAN_IDS } from "@/lib/plans";

const FEATURES = [
  { icon: "🌱", title: "Von der Idee zum Post", text: "Ideen-Pool, Research mit echten Quellen und Trend-Radar — alles an einem Ort." },
  { icon: "🤖", title: "Deine KI, deine Wahl", text: "Groq, GPT, Claude, Gemini, Perplexity — pro Bereich frei wählbar, mit deinem eigenen Schlüssel." },
  { icon: "🎠", title: "Content, der fertig ist", text: "Karussells, Captions, Hashtags, Blog & Newsletter — sofort veröffentlichbar." },
  { icon: "📅", title: "Planung & Repurpose", text: "Wochenplan, ein Inhalt in viele Formate, Caption-Bank & Northstar." },
  { icon: "🔒", title: "Sicher & DSGVO", text: "EU-Datenbank, verschlüsselte Schlüssel, tägliche Backups, volle Datenhoheit." },
  { icon: "🌿", title: "In deinem Ton", text: "Brand Voice in jeder Generierung — es klingt nach dir, nicht nach KI." },
];

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 1.5rem", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", color: "var(--accent)" }}>Raumo</div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a href="/login" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>Anmelden</a>
          <a href="/register" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Kostenlos starten</a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "4rem 1.5rem 3rem", textAlign: "center" }}>
        <div style={{ display: "inline-block", fontSize: "0.75rem", fontWeight: 600, color: "var(--accent2)", background: "var(--accent-light)", padding: "0.3rem 0.8rem", borderRadius: 99, marginBottom: "1.5rem" }}>
          KI-Content-Workspace für Creator
        </div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2.8rem", lineHeight: 1.15, color: "var(--text)", marginBottom: "1rem" }}>
          Wo Ideen Raum finden
        </h1>
        <p style={{ fontSize: "1.1rem", color: "var(--muted)", maxWidth: 560, margin: "0 auto 2rem" }}>
          Recherchieren, erstellen, planen — dein ganzer Content-Prozess an einem Ort.
          Mit der KI deiner Wahl, in deinem Ton. 14 Tage kostenlos.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/register" className="btn btn-primary" style={{ textDecoration: "none", padding: "0.75rem 1.75rem" }}>Kostenlos starten</a>
          <a href="/login" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.75rem 1.75rem" }}>Ich habe ein Konto</a>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "1rem" }}>Keine Zahlung beim Start · jederzeit kündbar</p>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card">
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{f.icon}</div>
              <h3 style={{ marginBottom: "0.35rem" }}>{f.title}</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", textAlign: "center", marginBottom: "0.4rem" }}>Faire Preise, alles inklusive</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.88rem", marginBottom: "2rem" }}>
          Alle Pläne mit allen Modulen. Der Unterschied: dein KI-Kontingent. Preise inkl., jährlich = 2 Monate gratis.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {PLAN_IDS.map(id => {
            const p = PLANS[id];
            return (
              <div key={id} className="card" style={{ textAlign: "center", border: p.highlight ? "2px solid var(--accent)" : undefined, position: "relative" }}>
                {p.highlight && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", fontSize: "0.68rem", fontWeight: 700, color: "#fff", background: "var(--accent)", padding: "0.15rem 0.7rem", borderRadius: 99 }}>Beliebt</div>}
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.15rem" }}>{p.name}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem", minHeight: "2.4em" }}>{p.tagline}</p>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent2)" }}>{p.monthly} €<span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>/Mon</span></div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0.5rem 0 1rem" }}>{p.aiMonthlyLimit === 0 ? "KI unbegrenzt" : `${p.aiMonthlyLimit} KI-Aufrufe/Mon`}</div>
                <a href="/register" className="btn btn-primary btn-sm" style={{ textDecoration: "none", width: "100%", justifyContent: "center" }}>14 Tage testen</a>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "2rem 1.5rem", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <a href="/impressum" style={{ color: "var(--muted)", textDecoration: "none" }}>Impressum</a>
          <a href="/datenschutz" style={{ color: "var(--muted)", textDecoration: "none" }}>Datenschutz</a>
          <a href="/agb" style={{ color: "var(--muted)", textDecoration: "none" }}>AGB</a>
          <a href="/avv" style={{ color: "var(--muted)", textDecoration: "none" }}>AVV</a>
        </div>
        made with ❤️ by <a href="https://toelsner.at" target="_blank" rel="noopener" style={{ color: "var(--accent)", textDecoration: "none" }}>Toelsner Digital</a>
      </footer>
    </div>
  );
}
