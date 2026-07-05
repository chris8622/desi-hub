"use client";
import { useState, useEffect } from "react";
import LoginGate from "@/components/LoginGate";
import { getLS, setLS } from "@/lib/storage";
import { scheduleSyncUp } from "@/lib/sync";
import { trackTokens } from "@/lib/tokens";
import type { SavedCaption } from "@/app/captions/page";

type Draft = { id: string; title: string; content: string; channel: string; savedAt: string };
type HistoryItem = { query: string; date: string; summary: string };

type RepurposeResult = {
  instagram_caption?: string;
  instagram_hashtags?: string[];
  newsletter_subject?: string;
  newsletter_preheader?: string;
  newsletter_body?: string;
  pinterest_title?: string;
  pinterest_description?: string;
  blog_title?: string;
  blog_intro?: string;
  _tokens?: number;
  error?: string;
};

const FORMAT_OPTIONS = [
  { key: "instagram",   label: "Instagram Caption", icon: "📱", desc: "Caption + Hashtags" },
  { key: "newsletter",  label: "Newsletter",         icon: "📧", desc: "Betreff + Text" },
  { key: "pinterest",   label: "Pinterest Pin",      icon: "📌", desc: "Titel + Beschreibung" },
  { key: "blog_intro",  label: "Blog-Einleitung",    icon: "✍️",  desc: "Titel + Intro-Absatz" },
];

function randomId() { return Math.random().toString(36).slice(2, 9); }

export default function RepurposePage() {
  const [sourceType, setSourceType] = useState<"paste" | "draft" | "research">("paste");
  const [sourceText, setSourceText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [researchHistory, setResearchHistory] = useState<HistoryItem[]>([]);
  const [selectedDraft, setSelectedDraft] = useState("");
  const [selectedResearch, setSelectedResearch] = useState("");
  const [formats, setFormats] = useState<string[]>(["instagram"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDrafts(getLS<Draft[]>("dh_drafts", []));
    setResearchHistory(getLS<HistoryItem[]>("dh_research_history", []));
  }, []);

  function getEffectiveSource(): string {
    if (sourceType === "paste") return sourceText;
    if (sourceType === "draft") {
      const d = drafts.find(d => d.id === selectedDraft);
      return d ? `# ${d.title}\n\n${d.content}` : "";
    }
    if (sourceType === "research") {
      const r = researchHistory.find(r => r.date === selectedResearch);
      if (!r) return "";
      // Strip HTML tags from research summary
      return `${r.query}\n\n${r.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`;
    }
    return "";
  }

  function toggleFormat(key: string) {
    setFormats(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  }

  async function generate() {
    const text = getEffectiveSource().trim();
    if (!text) { setError("Bitte einen Text eingeben oder auswählen."); return; }
    if (!formats.length) { setError("Bitte mindestens ein Format wählen."); return; }
    setLoading(true);
    setError("");
    setResult(null);
    setSavedKeys(new Set());
    try {
      const settings = getLS<Record<string, unknown>>("dh_settings", {});
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-token": localStorage.getItem("desi_auth_token") || "" },
        body: JSON.stringify({
          sourceText: text.slice(0, 6000),
          formats,
          brandVoice: settings,
        }),
      });
      const data = await res.json() as RepurposeResult;
      trackTokens(data._tokens || 0);
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Generieren");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  function saveToBank(text: string, hashtags: string[], channel: SavedCaption["channel"]) {
    const existing = getLS<SavedCaption[]>("dh_caption_bank", []);
    const entry: SavedCaption = {
      id: randomId(), text, hashtags, channel,
      notes: "Via Repurpose", savedAt: new Date().toISOString(),
    };
    setLS("dh_caption_bank", [entry, ...existing]);
    scheduleSyncUp(2000);
    setSavedKeys(prev => new Set([...prev, channel]));
  }

  const effectiveSource = getEffectiveSource();

  return (
    <LoginGate>
      <div style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1>Repurpose-Assistent</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.25rem" }}>
            Einen Text — mehrere Formate. Einmal schreiben, überall publishen.
          </p>
        </div>

        {/* Source selector */}
        <div className="card" style={{ marginBottom: "1.25rem", padding: "1.5rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "1rem" }}>1. Quelltext wählen</div>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {[
              { key: "paste",    label: "✏️ Text einfügen" },
              { key: "draft",    label: "📄 Blog-Entwurf" },
              { key: "research", label: "🔍 Research-Eintrag" },
            ].map(opt => (
              <button key={opt.key} onClick={() => { setSourceType(opt.key as typeof sourceType); setResult(null); }}
                className={sourceType === opt.key ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>
                {opt.label}
              </button>
            ))}
          </div>

          {sourceType === "paste" && (
            <textarea className="input" rows={6} value={sourceText} onChange={e => setSourceText(e.target.value)}
              placeholder="Deinen Text hier einfügen — Blog-Artikel, Research-Notizen, Ideen…"
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          )}

          {sourceType === "draft" && (
            drafts.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Noch keine Blog-Entwürfe gespeichert.</p>
            ) : (
              <select className="input" value={selectedDraft} onChange={e => setSelectedDraft(e.target.value)}>
                <option value="">— Entwurf wählen —</option>
                {drafts.map(d => <option key={d.id} value={d.id}>{d.title || "Ohne Titel"}</option>)}
              </select>
            )
          )}

          {sourceType === "research" && (
            researchHistory.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Noch keine Research-Einträge vorhanden.</p>
            ) : (
              <select className="input" value={selectedResearch} onChange={e => setSelectedResearch(e.target.value)}>
                <option value="">— Research-Eintrag wählen —</option>
                {researchHistory.map(r => (
                  <option key={r.date} value={r.date}>
                    {r.query} · {new Date(r.date).toLocaleDateString("de-AT")}
                  </option>
                ))}
              </select>
            )
          )}

          {effectiveSource && (
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
              {effectiveSource.length.toLocaleString("de-AT")} Zeichen geladen
            </p>
          )}
        </div>

        {/* Format selector */}
        <div className="card" style={{ marginBottom: "1.25rem", padding: "1.5rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "1rem" }}>2. Zielformate wählen</div>
          <div className="grid-2" style={{ gap: "0.65rem" }}>
            {FORMAT_OPTIONS.map(f => (
              <button key={f.key} onClick={() => toggleFormat(f.key)} style={{
                padding: "0.85rem 1rem", borderRadius: "var(--radius-sm)", cursor: "pointer",
                border: formats.includes(f.key) ? "2px solid var(--accent)" : "1px solid var(--border)",
                background: formats.includes(f.key) ? "var(--accent-light)" : "var(--surface2)",
                textAlign: "left", transition: "all 0.15s",
              }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem", color: formats.includes(f.key) ? "var(--accent2)" : "var(--text)" }}>
                  {f.icon} {f.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: "1.5rem" }}
          onClick={generate} disabled={loading || !effectiveSource.trim() || !formats.length}>
          {loading ? "✨ Formate werden erstellt…" : `✨ ${formats.length} Format${formats.length > 1 ? "e" : ""} generieren`}
        </button>

        {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        {/* Results */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Instagram */}
            {result.instagram_caption && (
              <div className="card" style={{ padding: "1.25rem", borderLeft: "3px solid var(--accent)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 700 }}>📱 Instagram Caption</div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => copy(result.instagram_caption! + (result.instagram_hashtags?.length ? "\n\n" + result.instagram_hashtags.map(h => `#${h}`).join(" ") : ""), "instagram")}>
                      {copiedKey === "instagram" ? "✓ Kopiert!" : "📋 Kopieren"}
                    </button>
                    <button className="btn btn-ghost btn-sm"
                      style={{ color: savedKeys.has("Instagram") ? "var(--sage)" : undefined }}
                      onClick={() => saveToBank(result.instagram_caption!, result.instagram_hashtags || [], "Instagram")}>
                      {savedKeys.has("Instagram") ? "✓ Gespeichert" : "💾 In Caption-Bank"}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result.instagram_caption}</p>
                {result.instagram_hashtags && result.instagram_hashtags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.65rem" }}>
                    {result.instagram_hashtags.map((h, i) => (
                      <span key={i} className="badge badge-terra" style={{ fontSize: "0.72rem" }}>#{h}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Newsletter */}
            {result.newsletter_subject && (
              <div className="card" style={{ padding: "1.25rem", borderLeft: "3px solid var(--gold)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 700 }}>📧 Newsletter</div>
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => copy(`Betreff: ${result.newsletter_subject}\nPreheader: ${result.newsletter_preheader || ""}\n\n${(result.newsletter_body || "").replace(/<[^>]+>/g, "")}`, "newsletter")}>
                    {copiedKey === "newsletter" ? "✓ Kopiert!" : "📋 Kopieren"}
                  </button>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Betreff: </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{result.newsletter_subject}</span>
                </div>
                {result.newsletter_preheader && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Preheader: </span>
                    <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic" }}>{result.newsletter_preheader}</span>
                  </div>
                )}
                {result.newsletter_body && (
                  <div style={{ fontSize: "0.88rem", lineHeight: 1.7, borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}
                    dangerouslySetInnerHTML={{ __html: result.newsletter_body }} />
                )}
              </div>
            )}

            {/* Pinterest */}
            {result.pinterest_title && (
              <div className="card" style={{ padding: "1.25rem", borderLeft: "3px solid var(--warm-red)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 700 }}>📌 Pinterest Pin</div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => copy(`${result.pinterest_title}\n\n${result.pinterest_description}`, "pinterest")}>
                      {copiedKey === "pinterest" ? "✓ Kopiert!" : "📋 Kopieren"}
                    </button>
                    <button className="btn btn-ghost btn-sm"
                      style={{ color: savedKeys.has("Pinterest") ? "var(--sage)" : undefined }}
                      onClick={() => saveToBank(result.pinterest_description!, [], "Pinterest")}>
                      {savedKeys.has("Pinterest") ? "✓ Gespeichert" : "💾 In Caption-Bank"}
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" }}>{result.pinterest_title}</div>
                <p style={{ fontSize: "0.88rem", lineHeight: 1.7, color: "var(--text)" }}>{result.pinterest_description}</p>
              </div>
            )}

            {/* Blog intro */}
            {result.blog_intro && (
              <div className="card" style={{ padding: "1.25rem", borderLeft: "3px solid var(--sage)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 700 }}>✍️ Blog-Einleitung</div>
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => copy(`# ${result.blog_title || ""}\n\n${result.blog_intro}`, "blog")}>
                    {copiedKey === "blog" ? "✓ Kopiert!" : "📋 Kopieren"}
                  </button>
                </div>
                {result.blog_title && <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.65rem" }}>{result.blog_title}</div>}
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result.blog_intro}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </LoginGate>
  );
}
