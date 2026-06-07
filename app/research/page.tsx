"use client";
import { useState, useEffect } from "react";
import LoginGate from "@/components/LoginGate";

type Source = { title: string; url: string; snippet: string; credibility?: { level: string; label: string; color: string } };
type FactCheck = { confidence: "hoch"|"mittel"|"niedrig"; confidence_reason: string; source_diversity: number; verified_claims: string[]; unverified_claims: string[]; red_flags: string[]; recommendation: string };
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [factCheck, setFactCheck] = useState<FactCheck | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setHistory(getLS<HistoryItem[]>("dh_research_history", []));
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, groqKey: getLS<{groq_key?:string}>("dh_settings",{}).groq_key || "" }),
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
              setSummary(evt.data.summary);
              setSources(evt.data.sources);
              setFactCheck(evt.data.factCheck || null);

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

  const exportMd = () => {
    if (!summary) return;
    const plain = summary.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
    const md = `# Research: ${query}\n_Datum: ${new Date().toLocaleDateString("de-AT")}_\n\n${plain}\n\n---\n\n## Quellen\n${sources.map(s => `- [${s.title}](${s.url})`).join("\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `research-${query.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
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

          {/* Suggested topics */}
          <div style={{ marginTop: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {SUGGESTED.map(topic => (
              <button
                key={topic}
                className="badge badge-muted"
                onClick={() => { setQuery(topic); runSearch(topic); }}
                style={{ cursor: "pointer", border: "none", fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}
                disabled={loading}
              >
                {topic}
              </button>
            ))}
          </div>
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
              <div className="flex-between" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                  📋 Zusammenfassung: <em>{query}</em>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={exportMd}>
                  Als .md exportieren
                </button>
              </div>
              <div
                style={{ lineHeight: 1.7, fontSize: "0.9rem" }}
                dangerouslySetInnerHTML={{ __html: summary }}
              />
            </div>

            {/* Faktencheck */}
            {factCheck && (
              <div className="card" style={{ borderLeft: `4px solid ${factCheck.confidence === "hoch" ? "var(--sage)" : factCheck.confidence === "mittel" ? "var(--gold)" : "var(--warm-red)"}` }}>
                <div className="flex-between" style={{ marginBottom: "1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>🔍 Faktencheck</div>
                  <span style={{
                    padding: "0.25rem 0.8rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700,
                    background: factCheck.confidence === "hoch" ? "var(--sage-light)" : factCheck.confidence === "mittel" ? "var(--gold-light)" : "var(--warm-red-light)",
                    color: factCheck.confidence === "hoch" ? "var(--sage)" : factCheck.confidence === "mittel" ? "var(--gold)" : "var(--warm-red)",
                  }}>
                    {factCheck.confidence === "hoch" ? "✅ Gut belegt" : factCheck.confidence === "mittel" ? "⚠️ Teilweise belegt" : "🔴 Vorsicht geboten"}
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>{factCheck.confidence_reason}</p>

                <div className="grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
                  {factCheck.verified_claims.length > 0 && (
                    <div style={{ background: "var(--sage-light)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--sage)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>✅ Mehrfach bestätigt</div>
                      <ul style={{ paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {factCheck.verified_claims.map((c, i) => <li key={i} style={{ fontSize: "0.82rem", color: "var(--text)" }}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {factCheck.unverified_claims.length > 0 && (
                    <div style={{ background: "var(--gold-light)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--gold)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>⚠️ Nur vereinzelt belegt</div>
                      <ul style={{ paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {factCheck.unverified_claims.map((c, i) => <li key={i} style={{ fontSize: "0.82rem", color: "var(--text)" }}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {factCheck.red_flags.length > 0 && (
                  <div style={{ background: "var(--warm-red-light)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "0.85rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--warm-red)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>🚩 Red Flags</div>
                    <ul style={{ paddingLeft: "1.1rem" }}>
                      {factCheck.red_flags.map((f, i) => <li key={i} style={{ fontSize: "0.82rem", color: "var(--warm-red)" }}>{f}</li>)}
                    </ul>
                  </div>
                )}

                <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>💡 Empfehlung für Content</div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text)" }}>{factCheck.recommendation}</p>
                </div>
              </div>
            )}

            {/* Sources grid */}
            {sources.length > 0 && (
              <div>
                <div className="section-label">Quellen ({sources.length})</div>
                <div className="grid-auto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                  {sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <div className="card-sm" style={{ padding: "0.85rem 1rem", cursor: "pointer", transition: "box-shadow 0.15s" }}
                        onMouseOver={e => (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"}
                        onMouseOut={e => (e.currentTarget as HTMLElement).style.boxShadow = ""}>
                        {s.credibility && (
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: s.credibility.color, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {s.credibility.level === "trusted" ? "✅" : s.credibility.level === "medium" ? "📰" : s.credibility.level === "forum" ? "💬" : s.credibility.level === "low" ? "⚠️" : "❓"} {s.credibility.label}
                          </div>
                        )}
                        <div style={{ fontWeight: 500, fontSize: "0.85rem", marginBottom: "0.3rem", color: "var(--text)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {s.title}
                        </div>
                        {s.snippet && (
                          <div style={{ fontSize: "0.78rem", color: "var(--muted)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {s.snippet}
                          </div>
                        )}
                        <div style={{ fontSize: "0.72rem", color: "var(--accent)", marginTop: "0.4rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {new URL(s.url).hostname}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
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
