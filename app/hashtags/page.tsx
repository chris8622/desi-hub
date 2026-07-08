"use client";
import { useState, useEffect } from "react";
import { getLS, setLS } from "@/lib/storage";
import { scheduleSyncUp } from "@/lib/sync";
import { trackTokens } from "@/lib/tokens";
import { apiFetch, errorMessage } from "@/lib/api";
import { uid } from "@/lib/id";
import type { HashtagSet } from "@/lib/types";
import { getBrandVoice } from "@/lib/brandvoice";
import { getAiChoice } from "@/lib/aichoice";


const EMOJIS = ["#️⃣", "🌿", "🌸", "💪", "✨", "🧘", "🍋", "🌙", "🔥", "💡", "🎯", "🌺"];



export default function HashtagsPage() {
  const [sets, setSets] = useState<HashtagSet[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🌿");
  const [newTags, setNewTags] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [suggestTopic, setSuggestTopic] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setSets(getLS<HashtagSet[]>("dh_hashtag_sets", []));
  }, []);

  function save(updated: HashtagSet[]) {
    setSets(updated);
    setLS("dh_hashtag_sets", updated);
    scheduleSyncUp(2000);
  }

  function createSet() {
    if (!newName.trim()) return;
    const tags = newTags.split(/[\n,]+/).map(t => t.trim().replace(/^#/, "")).filter(Boolean);
    const set: HashtagSet = { id: uid(), name: newName.trim(), emoji: newEmoji, tags, createdAt: new Date().toISOString() };
    save([set, ...sets]);
    setNewName(""); setNewTags(""); setNewEmoji("🌿"); setEditing(null);
  }

  function updateSet(id: string, partial: Partial<HashtagSet>) {
    save(sets.map(s => s.id === id ? { ...s, ...partial } : s));
  }

  function deleteSet(id: string) {
    save(sets.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function copyTags(set: HashtagSet) {
    const text = set.tags.map(t => `#${t}`).join(" ");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(set.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function suggestHashtags(setId: string) {
    if (!suggestTopic.trim()) return;
    setSuggestLoading(true);
    setSuggestError("");
    try {
      const settings = getBrandVoice();
      const data = await apiFetch<{ hashtags?: string[]; _tokens?: number }>("/api/generate", {
        method: "POST",
        body: { type: "hashtags", topic: suggestTopic, brandVoice: settings, ...getAiChoice() },
      });
      trackTokens(data._tokens || 0);
      if (data.hashtags?.length) {
        const currentSet = sets.find(s => s.id === setId);
        const existing = currentSet?.tags || [];
        const merged = [...new Set([...existing, ...data.hashtags])];
        updateSet(setId, { tags: merged });
        setSuggesting(null);
        setSuggestTopic("");
      }
    } catch (e) {
      setSuggestError(errorMessage(e));
    } finally {
      setSuggestLoading(false);
    }
  }

  return (
    <>
      <div style={{ maxWidth: 720 }}>
        <div className="flex-between" style={{ marginBottom: "2rem" }}>
          <div>
            <h1>Hashtag-Manager</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.25rem" }}>
              Fertige Sets per Klick kopieren — nie wieder manuell tippen
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            + Neues Set
          </button>
        </div>

        {/* Neues Set erstellen */}
        {editing === "new" && (
          <div className="card" style={{ marginBottom: "1.5rem", border: "1px solid var(--accent)", padding: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1rem" }}>Neues Hashtag-Set</div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setNewEmoji(e)} style={{
                  fontSize: "1.25rem", background: newEmoji === e ? "var(--accent-light)" : "var(--surface2)",
                  border: newEmoji === e ? "2px solid var(--accent)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "0.3rem 0.45rem", cursor: "pointer",
                }}>{e}</button>
              ))}
            </div>
            <div className="grid-2" style={{ gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label className="label">Name des Sets</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Morgenroutine" autoFocus />
              </div>
            </div>
            <label className="label">Hashtags (mit Komma oder Zeilenumbruch trennen, # optional)</label>
            <textarea className="input" rows={4} value={newTags} onChange={e => setNewTags(e.target.value)}
              placeholder={"morgenroutine, morgenmuffel, earlybird\nmindset, wachstum"}
              style={{ resize: "vertical", fontFamily: "inherit", marginBottom: "0.75rem" }}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-primary" onClick={createSet} disabled={!newName.trim()}>Speichern</button>
              <button className="btn btn-ghost" onClick={() => { setEditing(null); setNewName(""); setNewTags(""); }}>Abbrechen</button>
            </div>
          </div>
        )}

        {sets.length === 0 && editing !== "new" && (
          <div className="empty-state">
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>#️⃣</div>
            <div>Noch keine Hashtag-Sets</div>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              Erstelle dein erstes Set und kopiere es beim nächsten Post mit einem Klick.
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {sets.map(set => (
            <div key={set.id} className="card" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.4rem" }}>{set.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{set.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{set.tags.length} Hashtags</div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <button className="btn btn-primary btn-sm" onClick={() => copyTags(set)}>
                    {copiedId === set.id ? "✓ Kopiert!" : "📋 Kopieren"}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setExpandedId(expandedId === set.id ? null : set.id);
                    setSuggesting(null);
                  }}>
                    {expandedId === set.id ? "Schließen" : "Bearbeiten"}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--warm-red)" }} onClick={() => deleteSet(set.id)}>
                    ✕
                  </button>
                </div>
              </div>

              {/* Tag preview */}
              {expandedId !== set.id && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.75rem" }}>
                  {set.tags.slice(0, 12).map((t, i) => (
                    <span key={i} className="badge badge-terra" style={{ fontSize: "0.72rem" }}>#{t}</span>
                  ))}
                  {set.tags.length > 12 && (
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>+{set.tags.length - 12} weitere</span>
                  )}
                </div>
              )}

              {/* Expanded edit view */}
              {expandedId === set.id && (
                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.75rem" }}>
                    {set.tags.map((t, i) => (
                      <span key={i} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        background: "var(--accent-light)", borderRadius: 999,
                        padding: "0.2rem 0.6rem", fontSize: "0.78rem", color: "var(--accent2)",
                        border: "1px solid rgba(196,112,74,0.2)",
                      }}>
                        #{t}
                        <button onClick={() => updateSet(set.id, { tags: set.tags.filter((_, j) => j !== i) })}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "1rem", lineHeight: 1, padding: 0 }}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add tags manually */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <input className="input" id={`add-tags-${set.id}`} placeholder="Hashtags hinzufügen (kommagetrennt)" style={{ flex: 1 }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value;
                          const added = val.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean);
                          if (added.length) updateSet(set.id, { tags: [...new Set([...set.tags, ...added])] });
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      const inp = document.getElementById(`add-tags-${set.id}`) as HTMLInputElement;
                      if (!inp) return;
                      const added = inp.value.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean);
                      if (added.length) updateSet(set.id, { tags: [...new Set([...set.tags, ...added])] });
                      inp.value = "";
                    }}>Hinzufügen</button>
                  </div>

                  {/* AI suggest */}
                  {suggesting === set.id ? (
                    <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "0.85rem", marginBottom: "0.5rem" }}>
                      <label className="label">Thema für KI-Vorschläge</label>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input className="input" value={suggestTopic} onChange={e => setSuggestTopic(e.target.value)}
                          placeholder="z.B. Morgenroutine für Frauen" style={{ flex: 1 }}
                          onKeyDown={e => { if (e.key === "Enter") suggestHashtags(set.id); }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => suggestHashtags(set.id)} disabled={suggestLoading || !suggestTopic.trim()}>
                          {suggestLoading ? "…" : "✨ Vorschläge"}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSuggesting(null); setSuggestError(""); }}>✕</button>
                      </div>
                      {suggestError && <p style={{ color: "var(--warm-red)", fontSize: "0.8rem", marginTop: "0.4rem" }}>{suggestError}</p>}
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSuggesting(set.id); setSuggestTopic(""); setSuggestError(""); }}>
                      ✨ KI-Vorschläge hinzufügen
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
