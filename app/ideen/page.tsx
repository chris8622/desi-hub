"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { scheduleSyncUp } from "@/lib/sync";
import LoginGate from "@/components/LoginGate";
import { getLS, setLS } from "@/lib/storage";

// ─── Types ───────────────────────────────────────────────
type Status = "neu" | "recherchiert" | "in_arbeit" | "fertig";
interface Idee {
  id: string;
  title: string;
  notes: string;
  tags: string[];
  status: Status;
  createdAt: string;
  updatedAt: string;
}

// ─── Config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; emoji: string }> = {
  neu:          { label: "Neue Idee",   emoji: "🌱", color: "var(--sage)",     bg: "var(--sage-light)"      },
  recherchiert: { label: "Recherchiert",emoji: "🔍", color: "var(--gold)",     bg: "var(--gold-light)"      },
  in_arbeit:    { label: "In Arbeit",   emoji: "✍️", color: "var(--accent)",   bg: "var(--accent-light)"    },
  fertig:       { label: "Fertig",      emoji: "✅", color: "var(--muted)",    bg: "var(--surface2)"        },
};

const DEFAULT_TAGS = ["Mindset","Hormongesundheit","Hautpflege","Morgenroutine","Selbstdisziplin","Minimalismus","Ernährung","Bewegung","Mental Health","Ästhetik"];

// ─── Helpers ─────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ─── Component ───────────────────────────────────────────
export default function IdeenPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [ideen, setIdeen]       = useState<Idee[]>([]);
  const [filter, setFilter]     = useState<Status | "alle">("alle");
  const [tagFilter, setTagFilter] = useState<string>("alle");
  const [search, setSearch]     = useState("");

  // Quick-Add
  const [newTitle, setNewTitle] = useState("");
  const [newTags, setNewTags]   = useState<string[]>([]);
  const [newNotes, setNewNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  // Edit Modal
  const [editing, setEditing]   = useState<Idee | null>(null);

  // Available tags (from settings + defaults)
  const [availTags, setAvailTags] = useState<string[]>(DEFAULT_TAGS);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIdeen(getLS<Idee[]>("dh_ideenpool", []));
    const s = getLS<{ topics?: string[] }>("dh_settings", {});
    if (s.topics?.length) setAvailTags([...new Set([...DEFAULT_TAGS, ...s.topics])]);
    setMounted(true);
  }, []);

  const save = (updated: Idee[]) => {
    setIdeen(updated);
    setLS("dh_ideenpool", updated);
    scheduleSyncUp(3000);
  };

  // ── Quick Add ────────────────────────────────────────
  const addIdee = () => {
    const t = newTitle.trim();
    if (!t) return;
    const idee: Idee = {
      id: uid(), title: t, notes: newNotes.trim(),
      tags: newTags, status: "neu",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save([idee, ...ideen]);
    setNewTitle(""); setNewNotes(""); setNewTags([]); setShowNotes(false);
    inputRef.current?.focus();
  };

  const deleteIdee = (id: string) => {
    if (!window.confirm("Idee wirklich löschen?")) return;
    save(ideen.filter(i => i.id !== id));
  };

  const updateStatus = (id: string, status: Status) =>
    save(ideen.map(i => i.id === id ? { ...i, status, updatedAt: new Date().toISOString() } : i));

  const saveEdit = () => {
    if (!editing) return;
    save(ideen.map(i => i.id === editing.id ? { ...editing, updatedAt: new Date().toISOString() } : i));
    setEditing(null);
  };

  // ── Research starten ─────────────────────────────────
  const startResearch = (idee: Idee) => {
    setLS("dh_research_prefill", idee.title);
    updateStatus(idee.id, "recherchiert");
    router.push("/research");
  };

  // ── Content erstellen ────────────────────────────────
  const startContent = (idee: Idee) => {
    setLS("dh_research_context", { query: idee.title, summary: idee.notes ? `<p>${idee.notes}</p>` : "", sources: [], mode: "carousel" });
    router.push("/content");
  };

  // ── Filter ───────────────────────────────────────────
  const filtered = ideen.filter(i => {
    if (filter !== "alle" && i.status !== filter) return false;
    if (tagFilter !== "alle" && !i.tags.includes(tagFilter)) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.notes.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const allTags = [...new Set(ideen.flatMap(i => i.tags))].sort();
  const counts: Record<string, number> = {
    alle: ideen.length,
    neu: ideen.filter(i => i.status === "neu").length,
    recherchiert: ideen.filter(i => i.status === "recherchiert").length,
    in_arbeit: ideen.filter(i => i.status === "in_arbeit").length,
    fertig: ideen.filter(i => i.status === "fertig").length,
  };

  if (!mounted) return null;

  return (
    <LoginGate>
      <div style={{ maxWidth: 960 }}>

        {/* Header */}
        <div className="flex-between" style={{ marginBottom: "1.75rem" }}>
          <div>
            <h1>Ideen-Pool 🌱</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.2rem" }}>
              Ideen sammeln, ordnen und direkt in Action umwandeln
            </p>
          </div>
          <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: "2rem", color: "var(--accent)" }}>
            {ideen.length}
          </span>
        </div>

        {/* ── Quick-Add ── */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <input
                ref={inputRef}
                className="input"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && addIdee()}
                placeholder="💡 Neue Idee — einfach eintippen und Enter drücken…"
                style={{ fontSize: "1rem", fontWeight: 500 }}
              />
              {/* Tags wählen */}
              {newTitle && (
                <div style={{ marginTop: "0.65rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {availTags.map(tag => (
                    <button key={tag} onClick={() => setNewTags(p => p.includes(tag) ? p.filter(t=>t!==tag) : [...p,tag])}
                      style={{ padding: "0.22rem 0.65rem", borderRadius: 999, border: "1px solid", fontSize: "0.75rem", cursor: "pointer",
                        background: newTags.includes(tag) ? "var(--accent-light)" : "var(--surface2)",
                        borderColor: newTags.includes(tag) ? "var(--accent)" : "var(--border)",
                        color: newTags.includes(tag) ? "var(--accent2)" : "var(--muted)",
                        transition: "all 0.15s",
                      }}>
                      {tag}
                    </button>
                  ))}
                  <button onClick={() => setShowNotes(p => !p)}
                    style={{ padding: "0.22rem 0.65rem", borderRadius: 999, border: "1px solid var(--border)", fontSize: "0.75rem", cursor: "pointer", background: "var(--surface2)", color: "var(--muted)" }}>
                    {showNotes ? "Notiz ausblenden" : "+ Notiz"}
                  </button>
                </div>
              )}
              {showNotes && (
                <textarea className="textarea" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  placeholder="Gedanken, Quellen, Inspirationen…"
                  style={{ marginTop: "0.65rem", minHeight: 80 }} />
              )}
            </div>
            <button className="btn btn-primary" onClick={addIdee} disabled={!newTitle.trim()}
              style={{ marginTop: 2, whiteSpace: "nowrap" }}>
              Speichern
            </button>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Status Filter */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {(["alle", "neu", "recherchiert", "in_arbeit", "fertig"] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: "0.32rem 0.85rem", borderRadius: 999, border: "1px solid", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  background: filter === s ? (s === "alle" ? "var(--text)" : STATUS_CONFIG[s]?.bg || "var(--surface2)") : "var(--surface)",
                  borderColor: filter === s ? (s === "alle" ? "var(--text)" : STATUS_CONFIG[s]?.color || "var(--border)") : "var(--border)",
                  color: filter === s ? (s === "alle" ? "var(--bg)" : STATUS_CONFIG[s]?.color || "var(--text)") : "var(--muted)",
                  fontWeight: filter === s ? 700 : 400,
                }}>
                {s === "alle" ? "Alle" : STATUS_CONFIG[s].emoji + " " + STATUS_CONFIG[s].label}
                <span style={{ marginLeft: "0.35rem", opacity: 0.7 }}>({counts[s]})</span>
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Suche */}
          <input className="input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔎 Suchen…" style={{ maxWidth: 200, fontSize: "0.85rem" }} />
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            <button onClick={() => setTagFilter("alle")}
              style={{ padding: "0.2rem 0.65rem", borderRadius: 999, border: "1px solid", fontSize: "0.72rem", cursor: "pointer",
                background: tagFilter === "alle" ? "var(--surface2)" : "transparent",
                borderColor: tagFilter === "alle" ? "var(--border-hover)" : "var(--border)",
                color: tagFilter === "alle" ? "var(--text)" : "var(--muted)", fontWeight: tagFilter==="alle" ? 700 : 400 }}>
              Alle Themen
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setTagFilter(tag === tagFilter ? "alle" : tag)}
                style={{ padding: "0.2rem 0.65rem", borderRadius: 999, border: "1px solid", fontSize: "0.72rem", cursor: "pointer",
                  background: tagFilter === tag ? "var(--accent-light)" : "transparent",
                  borderColor: tagFilter === tag ? "var(--accent)" : "var(--border)",
                  color: tagFilter === tag ? "var(--accent2)" : "var(--muted)",
                  fontWeight: tagFilter === tag ? 700 : 400 }}>
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* ── Ideen Grid ── */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌱</div>
            <p>{ideen.length === 0 ? "Noch keine Ideen — einfach oben eintippen!" : "Keine Ideen gefunden."}</p>
          </div>
        ) : (
          <div className="ideen-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(290px, 100%), 1fr))", gap: "0.85rem" }}>
            {filtered.map(idee => {
              const st = STATUS_CONFIG[idee.status];
              return (
                <div key={idee.id} className="card" style={{ padding: "1.1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem", borderLeft: `3px solid ${st.color}` }}>
                  {/* Titel + Status */}
                  <div className="flex-between" style={{ alignItems: "flex-start", gap: "0.5rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", flex: 1, lineHeight: 1.4 }}>{idee.title}</div>
                    <select value={idee.status} onChange={e => updateStatus(idee.id, e.target.value as Status)}
                      style={{ fontSize: "0.72rem", padding: "0.2rem 0.4rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: st.bg, color: st.color, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([val, cfg]) => (
                        <option key={val} value={val}>{cfg.emoji} {cfg.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Notizen */}
                  {idee.notes && (
                    <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
                      {idee.notes.length > 120 ? idee.notes.slice(0, 120) + "…" : idee.notes}
                    </p>
                  )}

                  {/* Tags */}
                  {idee.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {idee.tags.map(tag => (
                        <span key={tag} style={{ padding: "0.15rem 0.55rem", borderRadius: 999, background: "var(--accent-light)", color: "var(--accent2)", fontSize: "0.7rem", fontWeight: 600 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Datum */}
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                    {new Date(idee.createdAt).toLocaleDateString("de-AT", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "0.65rem", marginTop: "auto" }}>
                    <button onClick={() => startResearch(idee)} className="btn btn-sm"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", flex: 1, justifyContent: "center" }}>
                      🔍 Research
                    </button>
                    <button onClick={() => startContent(idee)} className="btn btn-sm"
                      style={{ background: "var(--accent-light)", border: "1px solid rgba(196,112,74,0.3)", color: "var(--accent2)", flex: 1, justifyContent: "center" }}>
                      💡 Content
                    </button>
                    <button onClick={() => setEditing({ ...idee })} className="btn btn-ghost btn-sm" title="Bearbeiten" aria-label="Idee bearbeiten">✏️</button>
                    <button onClick={() => deleteIdee(idee.id)} className="btn btn-ghost btn-sm" title="Löschen" aria-label="Idee löschen"
                      style={{ color: "var(--warm-red)" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Edit Modal ── */}
        {editing && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(44,32,22,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "1.5rem" }}
            onClick={e => e.target === e.currentTarget && setEditing(null)}>
            <div className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
              <div className="flex-between" style={{ marginBottom: "1.25rem" }}>
                <h3>Idee bearbeiten</h3>
                <button onClick={() => setEditing(null)} className="btn btn-ghost" aria-label="Schließen" title="Schließen" style={{ fontSize: "1.2rem" }}>×</button>
              </div>

              <label className="label">Titel</label>
              <input className="input" value={editing.title} onChange={e => setEditing(p => p ? {...p, title: e.target.value} : p)}
                style={{ marginBottom: "1rem" }} />

              <label className="label">Notizen</label>
              <textarea className="textarea" value={editing.notes} onChange={e => setEditing(p => p ? {...p, notes: e.target.value} : p)}
                placeholder="Gedanken, Quellen, Inspirationen…" style={{ marginBottom: "1rem" }} />

              <label className="label">Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                {availTags.map(tag => (
                  <button key={tag} onClick={() => setEditing(p => p ? {...p, tags: p.tags.includes(tag) ? p.tags.filter(t=>t!==tag) : [...p.tags,tag]} : p)}
                    style={{ padding: "0.22rem 0.65rem", borderRadius: 999, border: "1px solid", fontSize: "0.75rem", cursor: "pointer",
                      background: editing.tags.includes(tag) ? "var(--accent-light)" : "var(--surface2)",
                      borderColor: editing.tags.includes(tag) ? "var(--accent)" : "var(--border)",
                      color: editing.tags.includes(tag) ? "var(--accent2)" : "var(--muted)" }}>
                    {tag}
                  </button>
                ))}
              </div>

              <label className="label">Status</label>
              <select className="select" value={editing.status} onChange={e => setEditing(p => p ? {...p, status: e.target.value as Status} : p)}
                style={{ marginBottom: "1.25rem" }}>
                {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.emoji} {cfg.label}</option>
                ))}
              </select>

              <div style={{ display: "flex", gap: "0.65rem" }}>
                <button className="btn btn-primary" onClick={saveEdit} style={{ flex: 1, justifyContent: "center" }}>Speichern</button>
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>Abbrechen</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </LoginGate>
  );
}
