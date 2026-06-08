"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginGate from "@/components/LoginGate";
import { trackTokens } from "@/lib/tokens";

type Source = { title: string; url: string; snippet: string; credibility?: { level: string; label: string; color: string } };
type Claim = { claim: string; sources: string[]; source_type: "seriös"|"forum"|"gemischt" };
type FactCheck = { confidence: "hoch"|"mittel"|"niedrig"; confidence_reason: string; source_diversity: number; verified_claims: Claim[]; unverified_claims: Claim[]; red_flags: string[]; recommendation: string };
type HistoryItem = { query: string; date: string; summary: string };

function getLS<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const SUGGESTED = [
  "Rückenschmerzen", "Burnout Erholung", "Hautpflege Routine",
  "Selbstdisziplin", "Intermittent Fasting", "Morgenroutine",
  "Hormongesundheit", "Minimalismus",
];

export default function ResearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [factCheck, setFactCheck] = useState<FactCheck | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [groqKey, setGroqKey] = useState("");
  const [trustedSources, setTrustedSources] = useState<Set<string>>(new Set());
  const [preferredDomains, setPreferredDomains] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<"all" | "trusted_only">("all");
  const [engine, setEngine] = useState<"standard" | "perplexity">("standard");
  const [hasPerplexity, setHasPerplexity] = useState(false);
  const [verifyingClaim, setVerifyingClaim] = useState<string | null>(null);

  useEffect(() => {
    setHistory(getLS<HistoryItem[]>("dh_research_history", []));
    const settings = getLS<{ groq_key?: string; trusted_sources?: string[]; perplexity_key?: string }>("dh_settings", {});
    setGroqKey(settings.groq_key || "");
    setPreferredDomains(settings.trusted_sources || []);
    setHasPerplexity(!!settings.perplexity_key);
    const saved = getLS<string[]>("dh_trusted_sources", []);
    setTrustedSources(new Set(saved));
    // Prefill aus Ideen-Pool
    const prefill = getLS<string>("dh_research_prefill", "");
    if (prefill) {
      setLS("dh_research_prefill", "");
      setQuery(prefill);
    }
  }, []);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setStatus("Starte Suche…");
    setSummary("");
    setSources([]);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-token": localStorage.getItem("desi_auth_token") || "" },
        body: JSON.stringify({
          query: q,
          groqKey: getLS<{groq_key?:string}>("dh_settings",{}).groq_key || "",
          perplexityKey: getLS<{perplexity_key?:string}>("dh_settings",{}).perplexity_key || "",
          engine,
          trustedDomains: getLS<{trusted_sources?:string[]}>("dh_settings",{}).trusted_sources || [],
          searchMode,
        }),
      });

      if (!res.body) throw new Error("Kein Stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "status") setStatus(evt.data);
            if (evt.type === "result") {
              trackTokens(evt.data.tokens || 0);
              setSummary(evt.data.summary || "");
              setSources(Array.isArray(evt.data.sources) ? evt.data.sources : []);
              // Faktencheck robust normalisieren — KI liefert nicht immer alle Felder
              const fc = evt.data.factCheck;
              if (fc && typeof fc === "object") {
                setFactCheck({
                  confidence: fc.confidence || "mittel",
                  confidence_reason: fc.confidence_reason || "",
                  source_diversity: fc.source_diversity || 0,
                  verified_claims: Array.isArray(fc.verified_claims) ? fc.verified_claims : [],
                  unverified_claims: Array.isArray(fc.unverified_claims) ? fc.unverified_claims : [],
                  red_flags: Array.isArray(fc.red_flags) ? fc.red_flags : [],
                  recommendation: fc.recommendation || "",
                });
              } else {
                setFactCheck(null);
              }

              const newItem: HistoryItem = { query: q, date: new Date().toISOString(), summary: evt.data.summary };
              setHistory(prev => {
                const updated = [...prev.filter(h => h.query !== q), newItem].slice(-20);
                setLS("dh_research_history", updated);
                return updated;
              });
            }
            if (evt.type === "error") setStatus(`Fehler: ${evt.data}`);
          } catch {}
        }
      }
    } catch (err) {
      setStatus(`Verbindungsfehler: ${err instanceof Error ? err.message : "Unbekannt"}`);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const buildMd = () => {
    const plain = summary.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
    return `# Research: ${query}\n_Datum: ${new Date().toLocaleDateString("de-AT")}_\n\n${plain}\n\n---\n\n## Quellen\n${sources.map(s => `- [${s.title}](${s.url})`).join("\n")}`;
  };

  const exportMd = () => {
    if (!summary) return;
    const blob = new Blob([buildMd()], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `research-${query.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
  };

  // Research in localStorage speichern + zur Zielseite navigieren
  const saveContext = (destination: "/editor" | "/content", mode?: string) => {
    const ctx = { query, summary, sources: sources.map(s => ({ title: s.title, url: s.url, snippet: s.snippet })), factCheck, date: new Date().toISOString(), mode };
    setLS("dh_research_context", ctx);
    router.push(destination);
  };

  const saveResearch = () => {
    const h = getLS<HistoryItem[]>("dh_research_history", []);
    const item: HistoryItem = { query, date: new Date().toISOString(), summary };
    const updated = [item, ...h.filter(x => x.query !== query)].slice(0, 30);
    setLS("dh_research_history", updated);
    setHistory(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Tiefere Research: mehr Quellen, wissenschaftliche Suche
  const toggleTrust = (domain: string) => {
    setTrustedSources(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain); else next.add(domain);
      setLS("dh_trusted_sources", [...next]);
      return next;
    });
  };

  const verifyClaim = async (claim: string) => {
    setVerifyingClaim(claim);
    const verifyQuery = `"${claim.slice(0, 60)}" ${query} wissenschaftlich belegt studie`;
    await runSearch(verifyQuery);
    setVerifyingClaim(null);
  };

  const deepResearch = async () => {
    if (!groqKey) { router.push("/settings"); return; }
    setDeepLoading(true);
    // Suchanfrage erweitern aber Original-Query behalten
    const originalQuery = query;
    const extendedQuery = `${query} wissenschaftliche studie peer review ergebnisse`;
    await runSearch(extendedQuery);
    setQuery(originalQuery); // Query zurücksetzen
    setDeepLoading(false);
  };

  return (
    <LoginGate>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Research 🔍</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Analysiere Foren & Diskussionen zu deinen Themen
          </p>
        </div>

        {/* Groq Key Warnung */}
        {!groqKey && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", background: "var(--gold-light)", border: "1px solid rgba(184,148,80,0.35)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1.1rem", marginBottom: "1.25rem" }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: "0.88rem", color: "var(--gold)" }}>Kein Groq API Key hinterlegt</strong>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                Die KI-Zusammenfassung und der Faktencheck funktionieren nicht. Quellen werden trotzdem gefunden.
              </p>
            </div>
            <button onClick={() => router.push("/settings")}
              style={{ background: "var(--gold)", color: "white", border: "none", borderRadius: "var(--radius-sm)", padding: "0.45rem 0.9rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              ⚙️ Key eintragen
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && runSearch(query)}
              placeholder="Thema recherchieren… z.B. Morgenroutine"
              disabled={loading}
            />
            <button
              className="btn btn-primary"
              onClick={() => runSearch(query)}
              disabled={loading || !query.trim()}
            >
              {loading ? "Suche läuft…" : "Recherchieren"}
            </button>
          </div>

          {/* Engine-Auswahl — nur wenn Perplexity Key vorhanden */}
          {hasPerplexity && (
            <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginRight: "0.2rem" }}>Engine:</span>
              <button onClick={() => setEngine("standard")}
                style={{ padding: "0.35rem 0.85rem", borderRadius: "var(--radius-sm)", border: "1px solid", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: engine === "standard" ? 700 : 400,
                  background: engine === "standard" ? "var(--text)" : "var(--surface2)", borderColor: engine === "standard" ? "var(--text)" : "var(--border)", color: engine === "standard" ? "var(--bg)" : "var(--muted)" }}>
                🆓 Standard
              </button>
              <button onClick={() => setEngine("perplexity")}
                style={{ padding: "0.35rem 0.85rem", borderRadius: "var(--radius-sm)", border: "1px solid", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: engine === "perplexity" ? 700 : 400,
                  background: engine === "perplexity" ? "var(--accent)" : "var(--surface2)", borderColor: engine === "perplexity" ? "var(--accent)" : "var(--border)", color: engine === "perplexity" ? "white" : "var(--muted)" }}>
                🔮 Perplexity (Premium)
              </button>
              {engine === "perplexity" && <span style={{ fontSize: "0.7rem", color: "var(--accent)" }}>Echtzeit-Web &amp; echte Quellen · kostenpflichtig</span>}
            </div>
          )}

          {/* Suggested topics */}
          <div style={{ marginTop: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {SUGGESTED.map(topic => (
              <button key={topic} className="badge badge-muted"
                onClick={() => { setQuery(topic); runSearch(topic); }}
                style={{ cursor: "pointer", border: "none", fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}
                disabled={loading}>
                {topic}
              </button>
            ))}
          </div>

          {/* Suchmodus Toggle */}
          {preferredDomains.length > 0 && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.85rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {/* Modus: Überall */}
                <button onClick={() => setSearchMode("all")}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.9rem", borderRadius: "var(--radius-sm)", border: "1px solid", cursor: "pointer", fontSize: "0.82rem", fontWeight: searchMode === "all" ? 700 : 400, fontFamily: "inherit", transition: "all 0.15s",
                    background: searchMode === "all" ? "var(--text)" : "var(--surface2)",
                    borderColor: searchMode === "all" ? "var(--text)" : "var(--border)",
                    color: searchMode === "all" ? "var(--bg)" : "var(--muted)" }}>
                  🌐 Überall suchen
                </button>
                {/* Modus: Nur bevorzugte */}
                <button onClick={() => setSearchMode("trusted_only")}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.9rem", borderRadius: "var(--radius-sm)", border: "1px solid", cursor: "pointer", fontSize: "0.82rem", fontWeight: searchMode === "trusted_only" ? 700 : 400, fontFamily: "inherit", transition: "all 0.15s",
                    background: searchMode === "trusted_only" ? "var(--sage)" : "var(--surface2)",
                    borderColor: searchMode === "trusted_only" ? "var(--sage)" : "var(--border)",
                    color: searchMode === "trusted_only" ? "white" : "var(--muted)" }}>
                  ⭐ Nur bevorzugte Quellen
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.73rem", color: "var(--muted)" }}>
                <span>{preferredDomains.length} Quellen aktiv</span>
                <button onClick={() => router.push("/settings")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "0.72rem", textDecoration: "underline", padding: 0 }}>
                  verwalten
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        {loading && status && (
          <div className="alert" style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="pulse-dot" />
            {status}
          </div>
        )}

        {/* Results */}
        {summary && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Summary card */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div className="flex-between" style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                  📋 Research: <em style={{ fontWeight: 400 }}>{query}</em>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {new Date().toLocaleDateString("de-AT", { day: "2-digit", month: "long" })}
                </span>
              </div>
              <div style={{ lineHeight: 1.7, fontSize: "0.9rem" }} dangerouslySetInnerHTML={{ __html: summary }} />
            </div>

            {/* ── ACTION BAR ── */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem 1.5rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "1rem" }}>
                Was möchtest du als nächstes tun?
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.65rem" }}>

                {/* Speichern */}
                <button onClick={saveResearch} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem", padding: "0.9rem 1rem", background: saved ? "var(--sage-light)" : "var(--surface2)", border: `1px solid ${saved ? "var(--sage)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
                  <span style={{ fontSize: "1.3rem" }}>{saved ? "✅" : "💾"}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: saved ? "var(--sage)" : "var(--text)" }}>{saved ? "Gespeichert!" : "Research speichern"}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Im Suchverlauf ablegen</span>
                </button>

                {/* Blogartikel */}
                <button onClick={() => saveContext("/editor", "blog")} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem", padding: "0.9rem 1rem", background: "var(--accent-light)", border: "1px solid rgba(196,112,74,0.25)", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}
                  onMouseOver={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"}
                  onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(196,112,74,0.25)"}>
                  <span style={{ fontSize: "1.3rem" }}>✍️</span>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--accent2)" }}>Blogartikel schreiben</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Research als Grundlage</span>
                </button>

                {/* Carousel */}
                <button onClick={() => saveContext("/content", "carousel")} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem", padding: "0.9rem 1rem", background: "var(--gold-light)", border: "1px solid rgba(184,148,80,0.25)", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}
                  onMouseOver={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--gold)"}
                  onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(184,148,80,0.25)"}>
                  <span style={{ fontSize: "1.3rem" }}>📱</span>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--gold)" }}>Carousel erstellen</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Insta-Slides generieren</span>
                </button>

                {/* Newsletter */}
                <button onClick={() => saveContext("/editor", "newsletter")} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem", padding: "0.9rem 1rem", background: "var(--sage-light)", border: "1px solid rgba(107,143,113,0.25)", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}
                  onMouseOver={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--sage)"}
                  onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(107,143,113,0.25)"}>
                  <span style={{ fontSize: "1.3rem" }}>📧</span>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--sage)" }}>Newsletter schreiben</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Für deine E-Mail Liste</span>
                </button>

                {/* Tiefer recherchieren */}
                <button onClick={deepResearch} disabled={deepLoading} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem", padding: "0.9rem 1rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: deepLoading ? "not-allowed" : "pointer", transition: "all 0.2s", textAlign: "left", opacity: deepLoading ? 0.6 : 1 }}>
                  <span style={{ fontSize: "1.3rem" }}>{deepLoading ? "⏳" : "🔬"}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>{deepLoading ? "Suche läuft…" : "Tiefer recherchieren"}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Studien & Wissenschaft</span>
                </button>

                {/* MD Export */}
                <button onClick={exportMd} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.25rem", padding: "0.9rem 1rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
                  <span style={{ fontSize: "1.3rem" }}>📄</span>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>Als .md exportieren</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Für Claude / Notion</span>
                </button>

              </div>
            </div>

            {/* Faktencheck — nur anzeigen wenn echte Claims vorhanden */}
            {factCheck && (factCheck.verified_claims.length > 0 || factCheck.unverified_claims.length > 0 || factCheck.red_flags.filter(f => f !== "Keine Quellenübersicht vorhanden").length > 0) && (
              <div className="card" style={{ borderLeft: `4px solid ${factCheck.confidence === "hoch" ? "var(--sage)" : factCheck.confidence === "mittel" ? "var(--gold)" : "var(--warm-red)"}` }}>
                <div className="flex-between" style={{ marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>🔍 Faktencheck</div>
                  <span style={{ padding: "0.25rem 0.8rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700, background: factCheck.confidence === "hoch" ? "var(--sage-light)" : factCheck.confidence === "mittel" ? "var(--gold-light)" : "var(--warm-red-light)", color: factCheck.confidence === "hoch" ? "var(--sage)" : factCheck.confidence === "mittel" ? "var(--gold)" : "var(--warm-red)" }}>
                    {factCheck.confidence === "hoch" ? "✅ Gut belegt" : factCheck.confidence === "mittel" ? "⚠️ Teilweise belegt" : "🔴 Vorsicht geboten"}
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1.25rem" }}>{factCheck.confidence_reason}</p>

                {/* Claim-Listen mit Quellen */}
                {[
                  { claims: factCheck.verified_claims,   label: "✅ Mehrfach bestätigt",      bg: "var(--sage-light)",     color: "var(--sage)",     border: "rgba(107,143,113,0.2)" },
                  { claims: factCheck.unverified_claims, label: "⚠️ Nur vereinzelt belegt",   bg: "var(--gold-light)",     color: "var(--gold)",     border: "rgba(184,148,80,0.2)"  },
                ].map(({ claims, label, bg, color, border }) => claims.length > 0 && (
                  <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: "var(--radius-sm)", padding: "1rem", marginBottom: "0.85rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.75rem", color, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {claims.map((c, i) => {
                        const claimObj = typeof c === "string"
                          ? { claim: c, sources: [] as string[], source_type: "gemischt" as const }
                          : { claim: c.claim || "", sources: Array.isArray(c.sources) ? c.sources : [], source_type: c.source_type || "gemischt" as const };
                        const allTrusted = claimObj.sources.length > 0 && claimObj.sources.every(s => trustedSources.has(s));
                        return (
                          <div key={i} style={{ background: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "0.75rem 0.85rem" }}>
                            <p style={{ fontSize: "0.85rem", color: "var(--text)", marginBottom: "0.5rem", lineHeight: 1.5 }}>{claimObj.claim}</p>

                            {/* Quellen-Badges */}
                            {claimObj.sources.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--muted)", alignSelf: "center" }}>Quelle:</span>
                                {claimObj.sources.map(domain => {
                                  const isTrusted = trustedSources.has(domain);
                                  return (
                                    <button key={domain} onClick={() => toggleTrust(domain)}
                                      title={isTrusted ? "Als vertrauenswürdig markiert — klicken zum Entfernen" : "Klicken um als vertrauenswürdig zu markieren"}
                                      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.15rem 0.55rem", borderRadius: 999, border: `1px solid ${isTrusted ? "var(--sage)" : "var(--border)"}`, background: isTrusted ? "var(--sage-light)" : "var(--surface)", color: isTrusted ? "var(--sage)" : "var(--muted)", fontSize: "0.72rem", fontWeight: isTrusted ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                                      {isTrusted ? "★" : "☆"} {domain}
                                    </button>
                                  );
                                })}
                                {claimObj.source_type && (
                                  <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: 999, background: claimObj.source_type === "seriös" ? "var(--sage-light)" : claimObj.source_type === "forum" ? "var(--surface2)" : "var(--gold-light)", color: claimObj.source_type === "seriös" ? "var(--sage)" : claimObj.source_type === "forum" ? "var(--muted)" : "var(--gold)", fontWeight: 600 }}>
                                    {claimObj.source_type === "seriös" ? "🏛 Seriöse Quelle" : claimObj.source_type === "forum" ? "💬 Forum" : "🔀 Gemischt"}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Verifizieren Button */}
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              {allTrusted && (
                                <span style={{ fontSize: "0.72rem", color: "var(--sage)", fontWeight: 600 }}>★ Vertrauenswürdige Quelle</span>
                              )}
                              <button onClick={() => verifyClaim(claimObj.claim)} disabled={verifyingClaim === claimObj.claim}
                                style={{ fontSize: "0.72rem", padding: "0.2rem 0.65rem", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", transition: "all 0.15s", marginLeft: "auto" }}>
                                {verifyingClaim === claimObj.claim ? "⏳ Suche…" : "🔬 Tiefer verifizieren"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {factCheck.red_flags.length > 0 && (
                  <div style={{ background: "var(--warm-red-light)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "0.85rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--warm-red)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>🚩 Red Flags</div>
                    <ul style={{ paddingLeft: "1.1rem" }}>
                      {factCheck.red_flags.map((f, i) => <li key={i} style={{ fontSize: "0.82rem", color: "var(--warm-red)" }}>{f}</li>)}
                    </ul>
                  </div>
                )}

                <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>💡 Empfehlung für Content</div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text)" }}>{factCheck.recommendation}</p>
                </div>
              </div>
            )}

            {/* Sources grid — immer angezeigt */}
            <div>
              <div className="flex-between" style={{ marginBottom: "0.65rem" }}>
                <div className="section-label" style={{ marginBottom: 0 }}>
                  📚 Quellen {sources.length > 0 ? `(${sources.length})` : ""}
                </div>
                {sources.length > 0 && (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                    Klick auf eine Quelle zum Öffnen
                  </span>
                )}
              </div>

              {sources.length === 0 ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1rem 1.25rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                  ⚠️ Keine Quellen gefunden — alle Seiten waren durch Bot-Schutz gesperrt. Versuche eine andere Suchanfrage oder wechsle zu "Überall suchen".
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                  {sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <div className="card-sm" style={{ padding: "0.85rem 1rem", cursor: "pointer", transition: "all 0.15s", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)" }}
                        onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "var(--shadow-md)"; el.style.borderColor = "var(--accent)"; }}
                        onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = ""; el.style.borderColor = "var(--border)"; }}>

                        {/* Domain + Badges */}
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.5rem" }}>
                          {(() => {
                            try {
                              const domain = new URL(s.url).hostname.replace("www.", "");
                              const isPreferred = preferredDomains.some(d => domain === d || domain.endsWith("." + d));
                              return <>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)" }}>{domain}</span>
                                {isPreferred && <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "var(--sage-light)", color: "var(--sage)", borderRadius: 999, padding: "0.1rem 0.45rem" }}>⭐ Bevorzugt</span>}
                                {s.credibility && <span style={{ fontSize: "0.65rem", fontWeight: 600, color: s.credibility.color }}>{s.credibility.level === "trusted" ? "✅" : s.credibility.level === "medium" ? "📰" : s.credibility.level === "forum" ? "💬" : s.credibility.level === "low" ? "⚠️" : "❓"} {s.credibility.label}</span>}
                              </>;
                            } catch { return null; }
                          })()}
                        </div>

                        {/* Titel */}
                        <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text)", marginBottom: "0.35rem", lineHeight: 1.4 }}>
                          {s.title}
                        </div>

                        {/* Snippet — immer vollständig anzeigen */}
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.55 }}>
                          {s.snippet || "Kein Vorschautext verfügbar — Artikel direkt öffnen"}
                        </div>

                        {/* URL immer sichtbar */}
                        <div style={{ fontSize: "0.68rem", color: "var(--accent)", marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <span>🔗</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.url}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && !summary && (
          <div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowHistory(!showHistory)}
              style={{ marginBottom: "0.75rem" }}
            >
              {showHistory ? "▲" : "▼"} Suchverlauf ({history.length})
            </button>
            {showHistory && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[...history].reverse().map((h, i) => (
                  <div
                    key={i}
                    className="card-sm"
                    style={{ padding: "0.75rem 1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    onClick={() => { setQuery(h.query); setSummary(h.summary); }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "0.88rem" }}>{h.query}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {new Date(h.date).toLocaleDateString("de-AT")}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--accent)" }}>Laden →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </LoginGate>
  );
}
