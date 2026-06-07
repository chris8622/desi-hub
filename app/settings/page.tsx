"use client";
import { useState, useEffect } from "react";
import LoginGate from "@/components/LoginGate";

const DEFAULT_SETTINGS = {
  name: "Desi",
  niche: "Mind, Health, Ästhetik & Selbstoptimierung",
  topics: ["Mindset", "Hormongesundheit", "Hautpflege", "Morgenroutine", "Selbstdisziplin", "Minimalismus"],
  voice: "warm-inspirierend",
  audience: "Frauen 25–40 die an sich arbeiten möchten",
  freq_instagram: 4,
  freq_blog: 1,
  freq_newsletter: 1,
  auto_plan: true,
  groq_key: "",
};

type Settings = typeof DEFAULT_SETTINGS;

function load(): Settings {
  try {
    const s = localStorage.getItem("dh_settings");
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setS(load()); setMounted(true); }, []);

  function save() {
    localStorage.setItem("dh_settings", JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function addTopic() {
    const t = newTopic.trim();
    if (!t || s.topics.includes(t)) return;
    setS(p => ({ ...p, topics: [...p.topics, t] }));
    setNewTopic("");
  }

  function removeTopic(t: string) {
    setS(p => ({ ...p, topics: p.topics.filter(x => x !== t) }));
  }

  if (!mounted) return null;

  return (
    <LoginGate>
    <div style={{ maxWidth: 720 }}>
      <div className="flex-between" style={{ marginBottom: "2rem" }}>
        <div>
          <h1>Einstellungen</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.25rem" }}>
            Profil, Automation & API-Keys
          </p>
        </div>
        <button className="btn btn-primary" onClick={save}>
          {saved ? "✓ Gespeichert" : "Speichern"}
        </button>
      </div>

      {/* Profil */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "1.25rem" }}>👤 Profil</h3>
        <div className="grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label className="label">Name</label>
            <input className="input" value={s.name} onChange={e => setS(p => ({ ...p, name: e.target.value }))} placeholder="Desi" />
          </div>
          <div>
            <label className="label">Zielgruppe</label>
            <input className="input" value={s.audience} onChange={e => setS(p => ({ ...p, audience: e.target.value }))} placeholder="Frauen 25–40..." />
          </div>
        </div>
        <div>
          <label className="label">Nische / Themenbereich</label>
          <input className="input" value={s.niche} onChange={e => setS(p => ({ ...p, niche: e.target.value }))} placeholder="Mind, Health, Ästhetik..." />
        </div>
      </div>

      {/* Brand Voice */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "1.25rem" }}>🎙️ Brand Voice</h3>
        <label className="label">Ton & Stil</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
          {[
            { val: "warm-inspirierend", label: "🌿 Warm & Inspirierend", desc: "Herzlich, motivierend, persönlich" },
            { val: "sachlich-kompetent", label: "📚 Sachlich & Kompetent", desc: "Faktenbasiert, professionell, klar" },
            { val: "direkt-motivierend", label: "🔥 Direkt & Motivierend", desc: "Knackig, antreibend, energetisch" },
            { val: "sanft-einfühlsam",  label: "🤍 Sanft & Einfühlsam",  desc: "Verständnisvoll, ruhig, nährend" },
          ].map(opt => (
            <button key={opt.val} onClick={() => setS(p => ({ ...p, voice: opt.val }))}
              style={{
                padding: "0.85rem 1rem", borderRadius: "var(--radius-sm)", cursor: "pointer",
                border: s.voice === opt.val ? "2px solid var(--accent)" : "1px solid var(--border)",
                background: s.voice === opt.val ? "var(--accent-light)" : "var(--surface2)",
                textAlign: "left", transition: "all 0.15s",
              }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: s.voice === opt.val ? "var(--accent2)" : "var(--text)" }}>{opt.label}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Themen */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "1.25rem" }}>🌱 Content-Themen</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Diese Themen werden für automatische Vorschläge und Content-Ideen verwendet.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {s.topics.map(t => (
            <span key={t} style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              background: "var(--accent-light)", border: "1px solid rgba(196,112,74,0.25)",
              borderRadius: 999, padding: "0.28rem 0.75rem", fontSize: "0.82rem", color: "var(--accent2)",
            }}>
              {t}
              <button onClick={() => removeTopic(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", lineHeight: 1, fontSize: "1rem", padding: 0 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input className="input" value={newTopic} onChange={e => setNewTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTopic()}
            placeholder="Neues Thema hinzufügen..." style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={addTopic}>+ Hinzufügen</button>
        </div>
      </div>

      {/* Posting-Frequenz & Automation */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>📅 Posting-Frequenz & Automation</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Wie oft postest du pro Woche auf jedem Kanal? Der Planer füllt sich automatisch.
        </p>
        <div className="grid-3" style={{ marginBottom: "1.25rem" }}>
          {[
            { key: "freq_instagram", label: "📸 Instagram", color: "var(--accent)" },
            { key: "freq_blog",      label: "✍️ Blog",       color: "var(--sage)"   },
            { key: "freq_newsletter",label: "📧 Newsletter", color: "var(--gold)"   },
          ].map(({ key, label, color }) => (
            <div key={key} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.65rem" }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.65rem" }}>
                <button onClick={() => setS(p => ({ ...p, [key]: Math.max(0, (p as never)[key] - 1) }))}
                  style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.8rem", color, minWidth: 32, textAlign: "center" }}>
                  {(s as never)[key]}
                </span>
                <button onClick={() => setS(p => ({ ...p, [key]: Math.min(7, (p as never)[key] + 1) }))}
                  style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.4rem" }}>× pro Woche</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
          <button onClick={() => setS(p => ({ ...p, auto_plan: !p.auto_plan }))}
            style={{
              width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", transition: "background 0.2s", position: "relative",
              background: s.auto_plan ? "var(--accent)" : "var(--border)",
            }}>
            <span style={{
              position: "absolute", top: 3, left: s.auto_plan ? 22 : 3,
              width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s",
            }} />
          </button>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Wochenplan automatisch erstellen</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Beim Öffnen des Planers werden leere Slots für die aktuelle Woche vorgeschlagen
            </div>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>🔑 API Keys</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Nur in deinem Browser gespeichert — wird für KI-Funktionen benötigt.
        </p>
        <label className="label">Groq API Key (kostenlos)</label>
        <input className="input" type="password" value={s.groq_key}
          onChange={e => setS(p => ({ ...p, groq_key: e.target.value }))}
          placeholder="gsk_..." />
        <p style={{ fontSize: "0.73rem", color: "var(--muted)", marginTop: "0.35rem" }}>
          Kostenlos holen unter{" "}
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>console.groq.com</a>
          {" "}→ API Keys → Create API Key
        </p>
        {s.groq_key && (
          <div className="alert alert-success" style={{ marginTop: "0.65rem", fontSize: "0.8rem" }}>
            ✓ API Key gesetzt — KI-Funktionen aktiv
          </div>
        )}
      </div>

      <button className="btn btn-primary" onClick={save} style={{ width: "100%", justifyContent: "center", padding: "0.85rem" }}>
        {saved ? "✓ Gespeichert!" : "Einstellungen speichern"}
      </button>
    </div>
    </LoginGate>
  );
}
