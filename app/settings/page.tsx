"use client";
import { useState, useEffect } from "react";
import LoginGate from "@/components/LoginGate";
import { scheduleSyncUp, syncDown, syncUp } from "@/lib/sync";
import { getTokenUsage } from "@/lib/tokens";

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
  perplexity_key: "",
  trusted_sources: [
    "pubmed.ncbi.nlm.nih.gov",
    "who.int",
    "gesundheit.gv.at",
    "cochrane.org",
    "derstandard.at",
    "orf.at",
  ],
};

// Verlässliche Quellen, nach Kategorie gruppiert
const SOURCE_CATEGORIES = [
  {
    category: "🔬 Wissenschaft & Studien",
    desc: "Höchste Verlässlichkeit — peer-reviewed Forschung",
    sources: [
      { domain: "pubmed.ncbi.nlm.nih.gov", label: "PubMed",     desc: "Medizinische Studien-Datenbank (NIH)" },
      { domain: "cochrane.org",            label: "Cochrane",   desc: "Systematische Reviews, Goldstandard" },
      { domain: "nature.com",              label: "Nature",     desc: "Top-Wissenschaftsjournal" },
      { domain: "science.org",             label: "Science",    desc: "Führendes Forschungsmagazin" },
      { domain: "springer.com",            label: "Springer",   desc: "Wissenschaftsverlag" },
      { domain: "sciencedirect.com",       label: "ScienceDirect", desc: "Elsevier Forschungsdatenbank" },
      { domain: "scholar.google.com",      label: "Google Scholar", desc: "Wissenschaftliche Suchmaschine" },
    ],
  },
  {
    category: "🏛️ Behörden & Gesundheitsorganisationen",
    desc: "Offizielle, geprüfte Gesundheitsinformationen",
    sources: [
      { domain: "who.int",            label: "WHO",              desc: "Weltgesundheitsorganisation" },
      { domain: "gesundheit.gv.at",   label: "Gesundheit.gv.at", desc: "Österreichs offiz. Gesundheitsportal" },
      { domain: "sozialministerium.at",label: "Sozialministerium",desc: "Österreich, Gesundheit & Soziales" },
      { domain: "ages.at",            label: "AGES",             desc: "Österr. Agentur f. Gesundheit" },
      { domain: "rki.de",             label: "RKI",              desc: "Robert Koch-Institut (DE)" },
      { domain: "bzga.de",            label: "BZgA",             desc: "Bundeszentrale f. gesundheitl. Aufklärung" },
      { domain: "cdc.gov",            label: "CDC",              desc: "US-Gesundheitsbehörde" },
    ],
  },
  {
    category: "⚕️ Medizin für Laien (geprüft)",
    desc: "Verständlich aufbereitet, redaktionell geprüft",
    sources: [
      { domain: "apotheken-umschau.de", label: "Apotheken Umschau", desc: "Bekannteste Gesundheits-Plattform DE" },
      { domain: "netdoktor.at",         label: "NetDoktor",         desc: "Medizinredaktion, ärztlich geprüft" },
      { domain: "gesund.at",            label: "Gesund.at",         desc: "Österr. Gesundheitsmagazin" },
      { domain: "mayoclinic.org",       label: "Mayo Clinic",       desc: "Renommierte US-Klinik" },
      { domain: "healthline.com",       label: "Healthline",        desc: "Medizinisch geprüft (EN)" },
      { domain: "medizin-transparent.at",label: "Medizin Transparent", desc: "Cochrane Österreich, Faktencheck" },
    ],
  },
  {
    category: "📰 Qualitätsmedien",
    desc: "Seriöser Journalismus mit Faktenprüfung",
    sources: [
      { domain: "orf.at",         label: "ORF",          desc: "Österreichischer Rundfunk" },
      { domain: "derstandard.at", label: "Der Standard", desc: "Österr. Qualitätszeitung" },
      { domain: "diepresse.com",  label: "Die Presse",   desc: "Österr. Qualitätszeitung" },
      { domain: "spiegel.de",     label: "Spiegel",      desc: "Deutsches Nachrichtenmagazin" },
      { domain: "zeit.de",        label: "Die Zeit",     desc: "Deutsche Wochenzeitung" },
      { domain: "sueddeutsche.de",label: "SZ",           desc: "Süddeutsche Zeitung" },
    ],
  },
];

// Flache Liste für die Logik
const SUGGESTED_TRUSTED = SOURCE_CATEGORIES.flatMap(c => c.sources);

type Settings = typeof DEFAULT_SETTINGS & { trusted_sources: string[] };

// ─── Groq Key Tester ────────────────────────────────────
function TestKeyButton({ groqKey }: { groqKey: string }) {
  const [state, setState] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [msg, setMsg] = useState("");

  async function test() {
    if (!groqKey) { setMsg("Bitte zuerst einen Key eintragen."); setState("error"); return; }
    setState("loading");
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: "Antworte nur: OK" }], max_tokens: 5 }),
      });
      const d = await res.json();
      if (res.ok) { setState("ok"); setMsg("✓ Key funktioniert!"); }
      else { setState("error"); setMsg(d?.error?.message || `Fehler ${res.status}`); }
    } catch (e) { setState("error"); setMsg((e as Error).message); }
    setTimeout(() => { setState("idle"); setMsg(""); }, 5000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0 }}>
      <button onClick={test} disabled={state === "loading"}
        style={{ background: state==="ok" ? "var(--sage)" : state==="error" ? "var(--warm-red)" : "var(--surface2)",
          border: "1px solid var(--border)", color: state==="ok"||state==="error" ? "white" : "var(--text)",
          borderRadius: "var(--radius-sm)", padding: "0 1rem", height: 42, fontSize: "0.82rem",
          fontWeight: 600, cursor: state==="loading" ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
        {state === "loading" ? "⏳ Test…" : "Key testen"}
      </button>
      {msg && <span style={{ fontSize: "0.7rem", color: state==="ok" ? "var(--sage)" : "var(--warm-red)", maxWidth: 120 }}>{msg}</span>}
    </div>
  );
}

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
  const [syncState, setSyncState] = useState<"idle"|"checking"|"ok"|"error">("idle");
  const [syncMsg, setSyncMsg] = useState("");
  const [tokenUsage, setTokenUsage] = useState({ date: "", tokens: 0, requests: 0 });

  useEffect(() => { setS(load()); setMounted(true); setTokenUsage(getTokenUsage()); }, []);

  function save() {
    localStorage.setItem("dh_settings", JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    scheduleSyncUp(2000); // nach 2s auf Server synchronisieren
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
        <div className="grid-2" style={{ gap: "0.65rem" }}>
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

      {/* Bevorzugte Quellen */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>🏛️ Bevorzugte Quellen</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Bei jeder Research wird gezielt auf diesen Seiten gesucht — ideal für wissenschaftlich belegte Infos.
          Aktive Quellen werden immer zusätzlich durchsucht.
        </p>

        {/* Quellen nach Kategorie */}
        {SOURCE_CATEGORIES.map(cat => (
          <div key={cat.category} style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>{cat.category}</span>
              <button
                onClick={() => {
                  const catDomains = cat.sources.map(x => x.domain);
                  const allActive = catDomains.every(d => (s.trusted_sources || []).includes(d));
                  setS(p => ({
                    ...p,
                    trusted_sources: allActive
                      ? (p.trusted_sources || []).filter(d => !catDomains.includes(d))
                      : [...new Set([...(p.trusted_sources || []), ...catDomains])],
                  }));
                }}
                style={{ fontSize: "0.7rem", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}>
                {cat.sources.every(x => (s.trusted_sources || []).includes(x.domain)) ? "Alle abwählen" : "Alle wählen"}
              </button>
            </div>
            <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.65rem" }}>{cat.desc}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {cat.sources.map(src => {
                const active = (s.trusted_sources || []).includes(src.domain);
                return (
                  <button key={src.domain}
                    onClick={() => setS(p => ({
                      ...p,
                      trusted_sources: active
                        ? (p.trusted_sources || []).filter(d => d !== src.domain)
                        : [...(p.trusted_sources || []), src.domain]
                    }))}
                    title={src.desc}
                    style={{
                      display: "inline-flex", flexDirection: "column", alignItems: "flex-start",
                      padding: "0.5rem 0.85rem", borderRadius: "var(--radius-sm)", cursor: "pointer",
                      border: `1px solid ${active ? "var(--sage)" : "var(--border)"}`,
                      background: active ? "var(--sage-light)" : "var(--surface2)",
                      transition: "all 0.15s", textAlign: "left", minWidth: 140,
                    }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: active ? "var(--sage)" : "var(--text)" }}>
                      {active ? "✓ " : ""}{src.label}
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "0.1rem" }}>{src.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Aktive Quellen */}
        {(s.trusted_sources || []).length > 0 && (
          <>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>
              Aktiv ({s.trusted_sources.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
              {s.trusted_sources.map(domain => (
                <span key={domain} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "var(--sage-light)", border: "1px solid rgba(107,143,113,0.3)", borderRadius: 999, padding: "0.25rem 0.75rem", fontSize: "0.78rem", color: "var(--sage)", fontWeight: 600 }}>
                  🏛️ {domain}
                  <button onClick={() => setS(p => ({ ...p, trusted_sources: p.trusted_sources.filter(d => d !== domain) }))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--sage)", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          </>
        )}

        {/* Eigene Domain hinzufügen */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input className="input" id="trusted-input" placeholder="z.B. medscape.com oder science.org" style={{ flex: 1, fontSize: "0.85rem" }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim().replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
                if (val && !(s.trusted_sources || []).includes(val)) {
                  setS(p => ({ ...p, trusted_sources: [...(p.trusted_sources || []), val] }));
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }} />
          <button className="btn btn-secondary" onClick={() => {
            const input = document.getElementById("trusted-input") as HTMLInputElement;
            const val = input?.value.trim().replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
            if (val && !(s.trusted_sources || []).includes(val)) {
              setS(p => ({ ...p, trusted_sources: [...(p.trusted_sources || []), val] }));
              if (input) input.value = "";
            }
          }}>+ Hinzufügen</button>
        </div>
      </div>

      {/* Token-Verbrauch */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>📊 Token-Verbrauch heute</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Groq Free-Tier: ca. 100.000 Tokens/Tag &amp; 12.000/Minute. Bei Erreichen einfach morgen weiter oder Content manuell erstellen.
        </p>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: "2rem", color: "var(--accent)" }}>{tokenUsage.tokens.toLocaleString("de-AT")}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tokens heute</div>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: "2rem", color: "var(--sage)" }}>{tokenUsage.requests}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>KI-Anfragen</div>
          </div>
        </div>
        {/* Fortschrittsbalken */}
        <div style={{ marginTop: "1rem", height: 8, background: "var(--surface2)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (tokenUsage.tokens / 100000) * 100)}%`, background: tokenUsage.tokens > 80000 ? "var(--warm-red)" : "var(--accent)", transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.4rem" }}>
          {Math.round((tokenUsage.tokens / 100000) * 100)}% des Tageslimits (Schätzung)
        </div>
      </div>

      {/* API Keys */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>🔑 API Keys</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Nur in deinem Browser gespeichert — wird für KI-Funktionen benötigt.
        </p>
        <label className="label">Groq API Key (kostenlos)</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input className="input" type="password" value={s.groq_key}
            onChange={e => setS(p => ({ ...p, groq_key: e.target.value }))}
            placeholder="gsk_..." style={{ flex: 1, minWidth: 200 }} />
          <TestKeyButton groqKey={s.groq_key} />
        </div>
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

        {/* Perplexity (optional, Premium-Research) */}
        <label className="label" style={{ marginTop: "1.25rem" }}>Perplexity API Key (optional, Premium-Research)</label>
        <input className="input" type="password" value={s.perplexity_key || ""}
          onChange={e => setS(p => ({ ...p, perplexity_key: e.target.value }))}
          placeholder="pplx-..." />
        <p style={{ fontSize: "0.73rem", color: "var(--muted)", marginTop: "0.35rem" }}>
          Für noch bessere Research mit Echtzeit-Web &amp; echten Quellen (kostenpflichtig, ~0,5–1 Cent/Anfrage). Holen unter{" "}
          <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>perplexity.ai/settings/api</a>.
          In der Research dann „🔮 Perplexity" wählen.
        </p>
        {s.perplexity_key && (
          <div className="alert alert-success" style={{ marginTop: "0.65rem", fontSize: "0.8rem" }}>
            ✓ Perplexity verfügbar — wähle es in der Research als Engine
          </div>
        )}
      </div>

      {/* Cross-Device Sync */}
      <div className="card" id="sync" style={{ marginBottom: "1.25rem", scrollMarginTop: "2rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>☁️ Cross-Device Sync</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Synchronisiere deine Daten zwischen Mac und Handy. Daten werden sicher auf dem Server gespeichert.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary" disabled={syncState === "checking"}
            onClick={async () => {
              const token = localStorage.getItem("desi_auth_token") || "";

              // Token fehlt → neu einloggen nötig
              if (!token) {
                setSyncState("error");
                setSyncMsg("relogin");
                return;
              }

              setSyncState("checking"); setSyncMsg("Teste Verbindung…");
              try {
                const res = await fetch("/api/sync", { headers: { "x-app-token": token } });
                const data = await res.json() as { available: boolean; error?: string };
                if (res.status === 401) {
                  setSyncState("error"); setSyncMsg("relogin");
                } else if (data.available) {
                  setSyncState("ok"); setSyncMsg("✓ Cloud-Sync aktiv! Daten werden zwischen Mac & Handy synchronisiert.");
                } else {
                  setSyncState("error"); setSyncMsg(data.error || "Noch nicht verbunden. Folge der Anleitung unten.");
                }
              } catch {
                setSyncState("error"); setSyncMsg("Verbindungsfehler — bitte Seite neu laden.");
              }
            }}>
            {syncState === "checking" ? "⏳ Prüfe…" : "Sync-Status prüfen"}
          </button>

          {syncState === "ok" && (
            <>
              <button className="btn btn-secondary" onClick={async () => {
                setSyncState("checking"); setSyncMsg("Lade vom Server…");
                const { available } = await syncDown();
                setSyncState(available ? "ok" : "error");
                setSyncMsg(available ? "✓ Daten vom Server geladen!" : "Fehler beim Laden.");
                if (available) setTimeout(() => window.location.reload(), 500);
              }}>⬇️ Vom Server laden</button>
              <button className="btn btn-secondary" onClick={async () => {
                setSyncState("checking"); setSyncMsg("Speichere auf Server…");
                const { success } = await syncUp();
                setSyncState(success ? "ok" : "error");
                setSyncMsg(success ? "✓ Auf Server gespeichert!" : "Fehler beim Speichern.");
              }}>⬆️ Auf Server speichern</button>
            </>
          )}
        </div>

        {syncMsg && (
          <div className={syncState === "ok" ? "alert alert-success" : syncState === "error" ? "alert alert-error" : "alert"}
            style={{ marginTop: "0.75rem", fontSize: "0.82rem" }}>
            {syncMsg}
          </div>
        )}

        {syncState === "error" && (
          <div style={{ marginTop: "1rem", background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.5rem" }}>Einrichtung (einmalig):</div>
            <ol style={{ paddingLeft: "1.2rem", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.8 }}>
              <li>Gehe zu <strong>vercel.com</strong> → Projekt <strong>desi-hub</strong> → <strong>Storage</strong></li>
              <li>Klicke auf <strong>Upstash</strong> → <strong>Upstash for Redis</strong> → <strong>Create</strong></li>
              <li>Klicke <strong>"Connect to Project"</strong> → desi-hub auswählen</li>
              <li>Einmal <strong>Redeploy</strong> in Vercel auslösen</li>
              <li>Zurück hier → <strong>Sync-Status prüfen</strong></li>
            </ol>
          </div>
        )}
      </div>

      {/* Export & Backup */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>💾 Backup & Export</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Alle Daten werden im Browser gespeichert. Erstelle regelmäßig ein Backup.
        </p>
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => {
            const backup = {
              exportedAt: new Date().toISOString(),
              settings: JSON.parse(localStorage.getItem("dh_settings") || "{}"),
              ideen: JSON.parse(localStorage.getItem("dh_ideenpool") || "[]"),
              planner: JSON.parse(localStorage.getItem("dh_planner") || "[]"),
              drafts: JSON.parse(localStorage.getItem("dh_drafts") || "[]"),
              subscribers: JSON.parse(localStorage.getItem("dh_subscribers") || "[]"),
              newsletters: JSON.parse(localStorage.getItem("dh_newsletters") || "[]"),
              researchHistory: JSON.parse(localStorage.getItem("dh_research_history") || "[]"),
            };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = `desi-hub-backup-${new Date().toISOString().split("T")[0]}.json`; a.click();
          }}>📦 Backup herunterladen</button>
          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            📥 Backup wiederherstellen
            <input type="file" accept=".json" style={{ display: "none" }} onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const text = await file.text();
              try {
                const backup = JSON.parse(text);
                if (backup.settings) localStorage.setItem("dh_settings", JSON.stringify(backup.settings));
                if (backup.ideen) localStorage.setItem("dh_ideenpool", JSON.stringify(backup.ideen));
                if (backup.planner) localStorage.setItem("dh_planner", JSON.stringify(backup.planner));
                if (backup.drafts) localStorage.setItem("dh_drafts", JSON.stringify(backup.drafts));
                if (backup.subscribers) localStorage.setItem("dh_subscribers", JSON.stringify(backup.subscribers));
                if (backup.newsletters) localStorage.setItem("dh_newsletters", JSON.stringify(backup.newsletters));
                alert("Backup erfolgreich wiederhergestellt! Seite wird neu geladen.");
                window.location.reload();
              } catch { alert("Fehler beim Lesen der Backup-Datei."); }
            }} />
          </label>
        </div>
      </div>

      <button className="btn btn-primary" onClick={save} style={{ width: "100%", justifyContent: "center", padding: "0.85rem" }}>
        {saved ? "✓ Gespeichert!" : "Einstellungen speichern"}
      </button>
    </div>
    </LoginGate>
  );
}
