"use client";
import { useState, useEffect } from "react";
import { getLS, setLS } from "@/lib/storage";
import { scheduleSyncUp } from "@/lib/sync";
import { uid } from "@/lib/id";

export type SavedCaption = {
  id: string;
  text: string;
  hashtags: string[];
  channel: "Instagram" | "Blog" | "Newsletter" | "Pinterest" | "Sonstiges";
  notes: string;
  savedAt: string;
};

const CHANNELS = ["Alle", "Instagram", "Pinterest", "Blog", "Newsletter", "Sonstiges"] as const;

const CHANNEL_COLORS: Record<string, string> = {
  Instagram: "badge-terra",
  Pinterest: "badge-red",
  Blog: "badge-sage",
  Newsletter: "badge-gold",
  Sonstiges: "badge-muted",
};


export default function CaptionsPage() {
  const [captions, setCaptions] = useState<SavedCaption[]>([]);
  const [filter, setFilter] = useState<typeof CHANNELS[number]>("Alle");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newHashtags, setNewHashtags] = useState("");
  const [newChannel, setNewChannel] = useState<SavedCaption["channel"]>("Instagram");
  const [newNotes, setNewNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState<{ id: string; val: string } | null>(null);

  useEffect(() => {
    setCaptions(getLS<SavedCaption[]>("dh_caption_bank", []));
  }, []);

  function save(updated: SavedCaption[]) {
    setCaptions(updated);
    setLS("dh_caption_bank", updated);
    scheduleSyncUp(2000);
  }

  function addCaption() {
    if (!newText.trim()) return;
    const tags = newHashtags.split(/[\n,\s]+/).map(t => t.replace(/^#/, "").trim()).filter(Boolean);
    const entry: SavedCaption = {
      id: uid(), text: newText.trim(), hashtags: tags,
      channel: newChannel, notes: newNotes.trim(), savedAt: new Date().toISOString(),
    };
    save([entry, ...captions]);
    setNewText(""); setNewHashtags(""); setNewNotes(""); setAdding(false);
  }

  function deleteCaption(id: string) {
    save(captions.filter(c => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function saveNotes(id: string, val: string) {
    save(captions.map(c => c.id === id ? { ...c, notes: val } : c));
    setEditingNotes(null);
  }

  function copyCaption(c: SavedCaption) {
    const tags = c.hashtags.length ? "\n\n" + c.hashtags.map(h => `#${h}`).join(" ") : "";
    navigator.clipboard.writeText(c.text + tags).then(() => {
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const visible = filter === "Alle" ? captions : captions.filter(c => c.channel === filter);

  return (
    <>
      <div style={{ maxWidth: 720 }}>
        <div className="flex-between" style={{ marginBottom: "2rem" }}>
          <div>
            <h1>Caption-Bank</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.25rem" }}>
              Captions & Hooks die funktioniert haben — zum Wiederverwenden
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Neue Caption</button>
        </div>

        {/* Neue Caption */}
        {adding && (
          <div className="card" style={{ marginBottom: "1.5rem", border: "1px solid var(--accent)", padding: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1rem" }}>Caption speichern</div>
            <label className="label">Caption-Text</label>
            <textarea className="input" rows={5} value={newText} onChange={e => setNewText(e.target.value)}
              placeholder="Caption hier einfügen…" style={{ resize: "vertical", fontFamily: "inherit", marginBottom: "0.75rem" }}
              autoFocus
            />
            <label className="label">Hashtags (optional, komma- oder leerzeichengetrennt)</label>
            <input className="input" value={newHashtags} onChange={e => setNewHashtags(e.target.value)}
              placeholder="morgenroutine mindset selfcare" style={{ marginBottom: "0.75rem" }}
            />
            <div className="grid-2" style={{ gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label className="label">Kanal</label>
                <select className="input" value={newChannel} onChange={e => setNewChannel(e.target.value as SavedCaption["channel"])}>
                  {(["Instagram", "Pinterest", "Blog", "Newsletter", "Sonstiges"] as const).map(ch => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notiz (optional)</label>
                <input className="input" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  placeholder="z.B. hat 200 Saves erzielt" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-primary" onClick={addCaption} disabled={!newText.trim()}>Speichern</button>
              <button className="btn btn-ghost" onClick={() => { setAdding(false); setNewText(""); setNewHashtags(""); setNewNotes(""); }}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          {CHANNELS.map(ch => (
            <button key={ch} onClick={() => setFilter(ch)}
              className={filter === ch ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>
              {ch}
              {ch !== "Alle" && (
                <span style={{ marginLeft: "0.3rem", fontSize: "0.7rem", opacity: 0.75 }}>
                  ({captions.filter(c => c.channel === ch).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {visible.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✍️</div>
            <div>{filter === "Alle" ? "Noch keine Captions gespeichert" : `Keine ${filter}-Captions`}</div>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              Captions aus dem Content-Bereich speichern oder manuell hinzufügen.
            </p>
          </div>
        )}

        {/* Caption list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {visible.map(c => {
            const expanded = expandedId === c.id;
            return (
              <div key={c.id} className="card" style={{ padding: "1.1rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                      <span className={`badge ${CHANNEL_COLORS[c.channel] || "badge-muted"}`} style={{ fontSize: "0.7rem" }}>
                        {c.channel}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {new Date(c.savedAt).toLocaleDateString("de-AT", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      {c.notes && <span style={{ fontSize: "0.72rem", color: "var(--gold)", fontStyle: "italic" }}>📝 {c.notes}</span>}
                    </div>
                    <p style={{
                      fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text)", margin: 0,
                      overflow: "hidden", display: "-webkit-box", WebkitLineClamp: expanded ? undefined : 3,
                      WebkitBoxOrient: "vertical" as const,
                      whiteSpace: "pre-wrap",
                    }}>
                      {c.text}
                    </p>
                    {c.hashtags.length > 0 && expanded && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.6rem" }}>
                        {c.hashtags.map((h, i) => (
                          <span key={i} className="badge badge-terra" style={{ fontSize: "0.7rem" }}>#{h}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => copyCaption(c)}>
                      {copiedId === c.id ? "✓" : "📋"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expanded ? null : c.id)}>
                      {expanded ? "▲" : "▼"}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--warm-red)" }} onClick={() => deleteCaption(c.id)}>
                      ✕
                    </button>
                  </div>
                </div>

                {/* Notes editing when expanded */}
                {expanded && (
                  <div style={{ marginTop: "0.85rem", borderTop: "1px solid var(--border)", paddingTop: "0.85rem" }}>
                    {editingNotes?.id === c.id ? (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input className="input" value={editingNotes.val}
                          onChange={e => setEditingNotes({ id: c.id, val: e.target.value })}
                          placeholder="Notiz (z.B. hat 200 Saves erzielt)" style={{ flex: 1 }}
                          onKeyDown={e => { if (e.key === "Enter") saveNotes(c.id, editingNotes.val); }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => saveNotes(c.id, editingNotes.val)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingNotes(null)}>✕</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingNotes({ id: c.id, val: c.notes })}>
                        📝 {c.notes ? `Notiz: "${c.notes}"` : "Notiz hinzufügen"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
