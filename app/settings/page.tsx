"use client";
import { useState, useEffect } from "react";
import { scheduleSyncUp, syncDown, syncUp, SYNC_KEYS } from "@/lib/sync";
import { THEMES, applyTheme } from "@/lib/theme";
import { TEXT_MODELS, RESEARCH_ENGINES } from "@/lib/llm";
import { AI_AREAS, AREA_LABELS } from "@/lib/aichoice";
import { apiFetch, errorMessage } from "@/lib/api";
import AiKeysCard from "@/components/AiKeysCard";
import BillingCard from "@/components/BillingCard";

// Backup umfasst genau die synchronisierten Keys
const BACKUP_KEYS = [...SYNC_KEYS];
import { getTokenUsage } from "@/lib/tokens";

// NEUTRALE Defaults — kein vorausgefülltes Profil einer bestimmten Person.
// Jede Nutzerin füllt Name/Nische/Themen selbst (bzw. der Onboarding-Flow).
const DEFAULT_SETTINGS = {
  name: "",
  niche: "",
  topics: [] as string[],
  voice: "warm-inspirierend",
  audience: "",
  brand_keywords: "",
  brand_avoid: "",
  freq_instagram: 4,
  freq_pinterest: 2,
  freq_blog: 1,
  freq_newsletter: 1,
  auto_plan: true,
  theme: "sand",
  ai_provider: "groq",
  ai_model: "llama-3.3-70b-versatile",
  ai_default: "" as string,                              // Standard-Modell (leer = Legacy/ai_model)
  ai_area: {} as Partial<Record<string, string>>,        // Overrides pro Bereich
  research_engine: "standard",
  trusted_sources: [] as string[],
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

// ─── Pinterest Connect Card ──────────────────────────────
function PinterestCard() {
  const [status, setStatus] = useState<"loading"|"unconfigured"|"disconnected"|"connected"|"error">("loading");
  const [username, setUsername]   = useState("");
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState("");

  // URL-Param auswerten (Callback-Redirect)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get("pinterest");
    if (p === "connected") { setMsg("✓ Pinterest erfolgreich verbunden!"); window.history.replaceState({}, "", window.location.pathname + "#pinterest"); }
    else if (p === "denied")  { setMsg("⚠️ Zugriff verweigert — bitte nochmal versuchen."); }
    else if (p)               { setMsg("⚠️ Fehler beim Verbinden. Bitte nochmal versuchen."); }
    loadStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStatus() {
    setStatus("loading");
    try {
      const d = await apiFetch<{ configured: boolean; connected: boolean; username?: string }>("/api/pinterest/status");
      if (!d.configured) { setStatus("unconfigured"); return; }
      if (d.connected) { setStatus("connected"); setUsername(d.username || ""); return; }
      setStatus("disconnected");
    } catch { setStatus("error"); }
  }

  async function connect() {
    setConnecting(true);
    setMsg("");
    try {
      const d = await apiFetch<{ configured?: boolean; authUrl?: string }>("/api/pinterest/auth");
      if (!d.configured) { setMsg("Pinterest ist noch nicht konfiguriert. Bitte die Anleitung unten befolgen."); setConnecting(false); return; }
      if (d.authUrl) window.location.href = d.authUrl;
    } catch (e) { setMsg(errorMessage(e)); setConnecting(false); }
  }

  async function disconnect() {
    if (!confirm("Pinterest-Verbindung trennen?")) return;
    try {
      await apiFetch("/api/pinterest/disconnect", { method: "POST" });
      setStatus("disconnected");
      setUsername("");
      setMsg("");
    } catch (e) { setMsg(errorMessage(e)); }
  }

  return (
    <div className="card" id="pinterest" style={{ marginBottom: "1.25rem", scrollMarginTop: "2rem" }}>
      <h3 style={{ marginBottom: "0.4rem" }}>📌 Pinterest verbinden</h3>
      <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
        Verbinde dein Pinterest-Konto um Pins direkt aus dem Content-Bereich zu posten — ohne manuelles Hochladen.
      </p>

      {status === "loading" && (
        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Prüfe Verbindung…</div>
      )}

      {status === "unconfigured" && (
        <div>
          <div className="alert alert-error" style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>
            Pinterest noch nicht konfiguriert — folge der Einrichtungsanleitung:
          </div>
          <PinterestSetupGuide />
        </div>
      )}

      {(status === "disconnected" || status === "error") && (
        <div>
          <button className="btn btn-primary" onClick={connect} disabled={connecting}>
            {connecting ? "⏳ Weiterleitung…" : "📌 Mit Pinterest verbinden"}
          </button>
          {status === "error" && (
            <div className="alert alert-error" style={{ marginTop: "0.75rem", fontSize: "0.82rem" }}>
              Fehler beim Prüfen der Verbindung.
            </div>
          )}
        </div>
      )}

      {status === "connected" && (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div className="alert alert-success" style={{ fontSize: "0.85rem", flex: 1 }}>
            ✓ Verbunden{username ? ` als @${username}` : ""}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={disconnect}>Trennen</button>
        </div>
      )}

      {msg && (
        <div
          className={msg.startsWith("✓") ? "alert alert-success" : "alert alert-error"}
          style={{ marginTop: "0.75rem", fontSize: "0.82rem" }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

function PinterestSetupGuide() {
  return (
    <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "1rem", fontSize: "0.8rem" }}>
      <div style={{ fontWeight: 700, marginBottom: "0.65rem" }}>Einrichtung (einmalig, ~5 Minuten):</div>
      <ol style={{ paddingLeft: "1.2rem", color: "var(--muted)", lineHeight: 2 }}>
        <li>Gehe zu <strong style={{ color: "var(--text)" }}>developers.pinterest.com</strong> → App erstellen</li>
        <li>Redirect URI eintragen: <code style={{ background: "var(--surface)", borderRadius: 4, padding: "1px 5px", fontSize: "0.78rem" }}>[deine-vercel-url]/api/pinterest/callback</code></li>
        <li>Scopes aktivieren: <strong style={{ color: "var(--text)" }}>boards:read</strong> und <strong style={{ color: "var(--text)" }}>pins:write</strong></li>
        <li>In Vercel → Environment Variables diese 3 Werte eintragen:
          <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
            <li><code style={{ background: "var(--surface)", borderRadius: 4, padding: "1px 5px", fontSize: "0.78rem" }}>PINTEREST_APP_ID</code></li>
            <li><code style={{ background: "var(--surface)", borderRadius: 4, padding: "1px 5px", fontSize: "0.78rem" }}>PINTEREST_APP_SECRET</code></li>
            <li><code style={{ background: "var(--surface)", borderRadius: 4, padding: "1px 5px", fontSize: "0.78rem" }}>PINTEREST_CALLBACK_URL</code> = <code style={{ background: "var(--surface)", borderRadius: 4, padding: "1px 5px", fontSize: "0.78rem" }}>https://[deine-domain]/api/pinterest/callback</code></li>
          </ul>
        </li>
        <li>Einmal Redeploy in Vercel → dann auf „Mit Pinterest verbinden" klicken</li>
      </ol>
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

  useEffect(() => {
    setS(load());
    setMounted(true);
    setTokenUsage(getTokenUsage());
    const refresh = () => setTokenUsage(getTokenUsage());
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

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

  // Theme sofort anwenden UND persistieren (unabhängig vom „Speichern"-Button)
  function pickTheme(key: string) {
    applyTheme(key);
    setS(p => {
      const next = { ...p, theme: key };
      try { localStorage.setItem("dh_settings", JSON.stringify(next)); } catch {}
      scheduleSyncUp(2000);
      return next;
    });
  }

  // Kompletter Reset — für die Übergabe an eine neue Person („neuer Nutzer")
  async function resetUser() {
    const ok = window.confirm(
      "Wirklich ALLES zurücksetzen?\n\nIdeen, Entwürfe, Pläne, Abonnenten, Einstellungen und das Design werden gelöscht. Das kann nicht rückgängig gemacht werden.",
    );
    if (!ok) return;
    try {
      const keep = new Set(["desi_auth", "desi_auth_token", "desi_session_expires"]);
      Object.keys(localStorage).forEach(k => {
        if (!keep.has(k) && (k.startsWith("dh_") || k.startsWith("desi_"))) localStorage.removeItem(k);
      });
    } catch {}
    applyTheme("sand");
    // Leeren Stand auf den Server schreiben, sonst kommt er beim Reload zurück
    try { await syncUp(); } catch {}
    window.location.href = "/";
  }

  if (!mounted) return null;

  return (
    <>
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
            <input className="input" value={s.name} onChange={e => setS(p => ({ ...p, name: e.target.value }))} placeholder="Dein Name" />
          </div>
          <div>
            <label className="label">Zielgruppe</label>
            <input className="input" value={s.audience} onChange={e => setS(p => ({ ...p, audience: e.target.value }))} placeholder="z. B. Berufstätige, die gesünder leben möchten" />
          </div>
        </div>
        <div>
          <label className="label">Nische / Themenbereich</label>
          <input className="input" value={s.niche} onChange={e => setS(p => ({ ...p, niche: e.target.value }))} placeholder="z. B. Fitness & Ernährung, Reisen, Finanzen…" />
        </div>
      </div>

      {/* Design / Theme */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>🎨 Design</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Wähle deine Farbwelt. Die Änderung ist sofort sichtbar und wird automatisch gespeichert.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem" }}>
          {THEMES.map(t => {
            const active = (s.theme || "sand") === t.key;
            return (
              <button key={t.key} onClick={() => pickTheme(t.key)}
                style={{
                  textAlign: "left", cursor: "pointer", padding: "0.75rem",
                  borderRadius: "var(--radius-sm)", background: "var(--surface)",
                  border: active ? "2px solid var(--accent)" : "1px solid var(--border)",
                  display: "flex", flexDirection: "column", gap: "0.5rem",
                }}>
                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: t.bg, border: "1px solid var(--border)", flexShrink: 0 }} />
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: t.accent, flexShrink: 0 }} />
                  {t.dark && <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>🌙</span>}
                </div>
                <span style={{ fontSize: "0.82rem", fontWeight: active ? 700 : 500, color: active ? "var(--accent2)" : "var(--text)" }}>
                  {t.label}{active ? " ✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KI-Modell */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>🤖 Deine KI</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Du wählst frei, welche KI arbeitet — als Standard und optional in jedem Bereich eine andere.
          Mit deinem eigenen Anbieter-Schlüssel (unten unter „KI-Verbindung") läuft alles über dein Konto.
        </p>

        <label className="label">Standard-Modell (gilt überall, wo unten nichts anderes gewählt ist)</label>
        <select className="select" value={s.ai_default || s.ai_model}
          onChange={e => {
            const m = TEXT_MODELS.find(t => t.model === e.target.value);
            setS(p => ({ ...p, ai_default: e.target.value, ai_model: e.target.value, ai_provider: m?.provider || p.ai_provider }));
          }}>
          {TEXT_MODELS.map(t => (
            <option key={`${t.provider}:${t.model}`} value={t.model}>{t.label}</option>
          ))}
        </select>

        <details style={{ marginTop: "1rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "var(--accent)" }}>
            Pro Bereich anpassen — deine Lieblings-KI je Aufgabe
          </summary>
          <div style={{ marginTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {AI_AREAS.map(area => (
              <div key={area} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text)", minWidth: 180, flex: "0 0 auto" }}>{AREA_LABELS[area]}</span>
                <select className="select" style={{ flex: 1, minWidth: 180 }}
                  value={s.ai_area?.[area] || ""}
                  onChange={e => setS(p => {
                    const next = { ...(p.ai_area || {}) };
                    if (e.target.value) next[area] = e.target.value; else delete next[area];
                    return { ...p, ai_area: next };
                  })}>
                  <option value="">— wie Standard —</option>
                  {TEXT_MODELS.map(t => <option key={`${area}:${t.model}`} value={t.model}>{t.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </details>

        <label className="label" style={{ marginTop: "1.25rem" }}>Research-Modus</label>
        <select className="select" value={s.research_engine}
          onChange={e => setS(p => ({ ...p, research_engine: e.target.value }))}>
          {RESEARCH_ENGINES.map(en => (
            <option key={en.id} value={en.id}>{en.label}</option>
          ))}
        </select>

        <p style={{ fontSize: "0.73rem", color: "var(--muted)", marginTop: "0.85rem" }}>
          Groq ist günstig &amp; schnell · Claude/GPT-4o liefern die feinste deutsche Prosa · Perplexity recherchiert live mit echten Quellen. Änderungen mit „Speichern" unten übernehmen.
        </p>
      </div>

      {/* Abo & Abrechnung */}
      <BillingCard />

      {/* KI-Verbindung (eigene Keys, BYOK) */}
      <AiKeysCard />

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
        <div className="grid-2" style={{ gap: "1rem", marginTop: "1.25rem" }}>
          <div>
            <label className="label">✨ Lieblingsworte & Phrasen</label>
            <textarea className="input" rows={3}
              value={(s as typeof s & { brand_keywords?: string }).brand_keywords || ""}
              onChange={e => setS(p => ({ ...p, brand_keywords: e.target.value }))}
              placeholder="z.B. verwurzelt, authentisch, wissenschaftlich belegt, mit Leichtigkeit…"
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.3rem" }}>Die KI verwendet diese Worte bevorzugt.</p>
          </div>
          <div>
            <label className="label">🚫 Tabu-Wörter</label>
            <textarea className="input" rows={3}
              value={(s as typeof s & { brand_avoid?: string }).brand_avoid || ""}
              onChange={e => setS(p => ({ ...p, brand_avoid: e.target.value }))}
              placeholder="z.B. toxic positivity, perfekt, du musst, solltest…"
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.3rem" }}>Diese Wörter vermeidet die KI.</p>
          </div>
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
              <button onClick={() => removeTopic(t)} aria-label={`Thema ${t} entfernen`} title="Entfernen" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", lineHeight: 1, fontSize: "1rem", padding: 0 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input className="input" value={newTopic} onChange={e => setNewTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTopic()}
            placeholder="Neues Thema hinzufügen…" style={{ flex: 1, minWidth: 180 }} />
          <button className="btn btn-secondary" onClick={addTopic}>+ Hinzufügen</button>
        </div>
      </div>

      {/* Posting-Frequenz & Automation */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.4rem" }}>📅 Posting-Frequenz & Automation</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Wie oft postest du pro Woche auf jedem Kanal? Der Planer füllt sich automatisch.
        </p>
        <div className="freq-grid" style={{ marginBottom: "1.25rem" }}>
          {[
            { key: "freq_instagram", label: "📸 Instagram", color: "var(--accent)"    },
            { key: "freq_pinterest", label: "📌 Pinterest", color: "var(--warm-red)" },
            { key: "freq_blog",      label: "✍️ Blog",       color: "var(--sage)"     },
            { key: "freq_newsletter",label: "📧 Newsletter", color: "var(--gold)"     },
          ].map(({ key, label, color }) => (
            <div key={key} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.65rem" }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.65rem" }}>
                <button onClick={() => setS(p => ({ ...p, [key]: Math.max(0, (p as never)[key] - 1) }))}
                  style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", color, minWidth: 32, textAlign: "center" }}>
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
                    aria-label={`Quelle ${domain} entfernen`} title="Entfernen"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--sage)", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          </>
        )}

        {/* Eigene Domain hinzufügen */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input className="input" id="trusted-input" placeholder="z.B. medscape.com oder science.org" style={{ flex: 1, minWidth: 180, fontSize: "0.85rem" }}
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
        <h3 style={{ marginBottom: "0.4rem" }}>📊 KI-Nutzung heute</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Dein kostenloses KI-Kontingent reicht für ca. 20–30 Analysen pro Tag. Bei Erreichen einfach morgen weitermachen.
        </p>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--accent)" }}>{tokenUsage.requests}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Analysen heute</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", color: "var(--sage)" }}>
              {tokenUsage.tokens > 0 ? tokenUsage.tokens.toLocaleString("de-AT") : "—"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Verarbeitete Wörter</div>
          </div>
        </div>
        {/* Fortschrittsbalken */}
        <div style={{ marginTop: "1rem", height: 8, background: "var(--surface2)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (tokenUsage.tokens / 100000) * 100)}%`, background: tokenUsage.tokens > 80000 ? "var(--warm-red)" : "var(--accent)", transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.4rem" }}>
          {tokenUsage.tokens > 0
            ? `${Math.round((tokenUsage.tokens / 100000) * 100)}% des Tageskontingents genutzt`
            : tokenUsage.requests > 0 ? `${tokenUsage.requests} Anfrage${tokenUsage.requests > 1 ? "n" : ""} heute` : "Noch keine KI-Nutzung heute"
          }
        </div>
      </div>

      {/* Pinterest Verbindung */}
      <PinterestCard />

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
                // Bewusst rohes fetch: dieser Diagnose-Klick behandelt 401 selbst
                // („relogin"-Hinweis) statt über apiFetch sofort auszuloggen.
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
            const backup: Record<string, unknown> = { exportedAt: new Date().toISOString() };
            for (const key of BACKUP_KEYS) {
              try { const raw = localStorage.getItem(key); backup[key] = raw ? JSON.parse(raw) : null; } catch { backup[key] = null; }
            }
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
                for (const key of BACKUP_KEYS) {
                  if (backup[key] !== undefined && backup[key] !== null) {
                    localStorage.setItem(key, JSON.stringify(backup[key]));
                  }
                }
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

      {/* Zurücksetzen — Gefahrenzone */}
      <div className="card" style={{ marginTop: "2rem", marginBottom: "1.25rem", border: "1px solid rgba(192,72,60,0.35)" }}>
        <h3 style={{ marginBottom: "0.4rem", color: "var(--warm-red)" }}>⚠️ Zurücksetzen</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Löscht alle Inhalte, Einstellungen und das Design und startet frisch —
          z. B. um den Workspace an eine andere Person zu übergeben. Kann nicht rückgängig gemacht werden.
        </p>
        <button onClick={resetUser}
          style={{
            background: "var(--warm-red)", color: "white", border: "none",
            borderRadius: "var(--radius-sm)", padding: "0.7rem 1.1rem",
            fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
          }}>
          Alles zurücksetzen
        </button>
      </div>
    </div>
    </>
  );
}
