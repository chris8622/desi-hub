"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { scheduleSyncUp } from "@/lib/sync";
import { useSearchParams } from "next/navigation";
import LoginGate from "@/components/LoginGate";
import { getLS, setLS } from "@/lib/storage";

type Draft = { id: string; title: string; content: string; channel: string; savedAt: string };
type PlannerItem = { id: string; date: string; channel: string; title: string; status: string; draftId?: string };

function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Blockquote
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr>")
    ;

  // Handle unordered lists (consecutive lines starting with - or *)
  html = html.replace(/((?:^[-*] .+\n?)+)/gm, (match) => {
    const items = match.trim().split("\n")
      .map(line => line.replace(/^[-*] /, "").trim())
      .filter(Boolean)
      .map(item => `<li>${item}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Handle ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split("\n")
      .map(line => line.replace(/^\d+\. /, "").trim())
      .filter(Boolean)
      .map(item => `<li>${item}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: wrap non-tag lines in <p>
  html = html.split("\n").map(line => {
    line = line.trim();
    if (!line) return "";
    if (/^<(h[1-6]|ul|ol|li|blockquote|hr|p)/.test(line)) return line;
    return `<p>${line}</p>`;
  }).join("\n");

  return html;
}

const CHANNELS = ["Instagram", "Blog", "Newsletter"];

function EditorInner() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [channel, setChannel] = useState("Blog");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [autosaveIndicator, setAutosaveIndicator] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedContentRef = useRef<string>("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load draft from URL param (?draft=ID)
    const urlDraftId = searchParams.get("draft");
    if (urlDraftId) {
      const allDrafts = getLS<Draft[]>("dh_drafts", []);
      const urlDraft = allDrafts.find(d => d.id === urlDraftId);
      if (urlDraft) {
        setTitle(urlDraft.title);
        setContent(urlDraft.content);
        setChannel(urlDraft.channel);
        setActiveDraftId(urlDraft.id);
        lastSavedContentRef.current = urlDraft.content;
        setDrafts(allDrafts);
        return;
      }
    }

    // Research-Kontext von Research-Seite übernehmen
    const ctx = getLS<{ query: string; summary: string; sources: {title:string;url:string}[]; mode?: string } | null>("dh_research_context", null);
    if (ctx) {
      setLS("dh_research_context", null); // always clear after reading
      const mode = ctx.mode || "blog";
      const sourcesBlock = ctx.sources?.length
        ? `\n\n---\n## Quellen\n${ctx.sources.map(s => `- [${s.title}](${s.url})`).join("\n")}`
        : "";
      const researchBlock = ctx.summary
        ? `\n\n> **Research-Zusammenfassung:**\n> ${ctx.summary.replace(/<[^>]+>/g," ").replace(/\s{2,}/g," ").trim()}`
        : "";
      if (mode === "newsletter") {
        setChannel("Newsletter");
        setTitle(`Newsletter: ${ctx.query}`);
        setContent(`# ${ctx.query}\n\nHallo [Name],\n\n${researchBlock}\n\n## Das nehme ich für dich mit\n\n[Hier deine persönliche Perspektive einfügen]\n\n## Was du jetzt tun kannst\n\n1. \n2. \n3. \n\nHerzlich,\nDesi${sourcesBlock}`);
      } else {
        setChannel("Blog");
        setTitle(`Blog: ${ctx.query}`);
        setContent(`# ${ctx.query}\n${researchBlock}\n\n## Einleitung\n\n[Hier deine persönliche Einleitung schreiben]\n\n## Was steckt dahinter?\n\n[Hintergrundinformationen aus der Research]\n\n## Was das für dich bedeutet\n\n[Praktische Tipps und persönliche Perspektive]\n\n## Fazit\n\n[Zusammenfassung und Call-to-Action]${sourcesBlock}`);
      }
    } else {
      const current = getLS<{ title: string; content: string; channel: string } | null>("dh_current_draft", null);
      if (current) {
        setTitle(current.title || "");
        setContent(current.content || "");
        setChannel(current.channel || "Blog");
        lastSavedContentRef.current = current.content || "";
        setLS("dh_current_draft", null);
      } else {
        // Check for autosave if no draft was explicitly loaded
        const autosave = getLS<{ title: string; content: string; channel: string } | null>("dh_editor_autosave", null);
        if (autosave && autosave.content) {
          const restore = window.confirm(
            `Nicht gespeicherter Entwurf gefunden: "${autosave.title || "Ohne Titel"}"\n\nMöchtest du ihn wiederherstellen?`
          );
          if (restore) {
            setTitle(autosave.title || "");
            setContent(autosave.content || "");
            setChannel(autosave.channel || "Blog");
          }
        }
      }
    }
    setDrafts(getLS<Draft[]>("dh_drafts", []));
  }, []);

  // Autosave with 2-second debounce
  const triggerAutosave = useCallback((newTitle: string, newContent: string, newChannel: string) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      setLS("dh_editor_autosave", { title: newTitle, content: newContent, channel: newChannel });
      setAutosaveIndicator(true);
      setTimeout(() => setAutosaveIndicator(false), 2000);
    }, 2000);
  }, []);

  // Dirty state tracking and beforeunload warning
  useEffect(() => {
    setIsDirty(content !== lastSavedContentRef.current);
  }, [content]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "Du hast ungespeicherte Änderungen. Wirklich verlassen?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const insertAtCursor = (before: string, after: string = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const TOOLBAR = [
    { label: "H1", action: () => insertAtCursor("# ", "") },
    { label: "H2", action: () => insertAtCursor("## ", "") },
    { label: "Fett", action: () => insertAtCursor("**", "**") },
    { label: "Liste", action: () => insertAtCursor("- ", "") },
    { label: "Zitat", action: () => insertAtCursor("> ", "") },
  ];

  const saveDraft = () => {
    const now = new Date().toISOString();
    const allDrafts = getLS<Draft[]>("dh_drafts", []);

    if (activeDraftId) {
      const updated = allDrafts.map(d =>
        d.id === activeDraftId ? { ...d, title, content, channel, savedAt: now } : d
      );
      setLS("dh_drafts", updated);
      setDrafts(updated);
    } else {
      const newDraft: Draft = { id: crypto.randomUUID(), title: title || "Ohne Titel", content, channel, savedAt: now };
      const updated = [newDraft, ...allDrafts];
      setLS("dh_drafts", updated);
      setDrafts(updated);
      setActiveDraftId(newDraft.id);
    }

    // Clear autosave after explicit save, update last-saved reference
    setLS("dh_editor_autosave", null);
    lastSavedContentRef.current = content;
    setIsDirty(false);
    scheduleSyncUp(2000);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const loadDraft = (draft: Draft) => {
    setTitle(draft.title);
    setContent(draft.content);
    setChannel(draft.channel);
    setActiveDraftId(draft.id);
  };

  const deleteDraft = (id: string) => {
    const updated = drafts.filter(d => d.id !== id);
    setDrafts(updated);
    setLS("dh_drafts", updated);
    scheduleSyncUp(3000);
    if (activeDraftId === id) {
      setTitle(""); setContent(""); setActiveDraftId(null);
    }
  };

  const exportMd = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(title || "draft").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const newDraft = () => {
    setTitle(""); setContent(""); setChannel("Blog"); setActiveDraftId(null);
  };

  return (
    <LoginGate>
      <div className="editor-layout" style={{ display: "flex", gap: "1.25rem", height: "calc(100vh - 8rem)", maxWidth: "100%", minHeight: 500 }}>
        {/* Left: drafts sidebar */}
        <div className="editor-drafts" style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Drafts</div>
            <button className="btn btn-ghost btn-sm" onClick={newDraft}>+ Neu</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {drafts.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: "0.8rem", padding: "0.5rem 0" }}>Noch keine Drafts</div>
            )}
            {drafts.map(d => (
              <div
                key={d.id}
                onClick={() => loadDraft(d)}
                style={{
                  padding: "0.6rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  background: activeDraftId === d.id ? "var(--accent-light)" : "var(--surface)",
                  border: "1px solid",
                  borderColor: activeDraftId === d.id ? "var(--accent)" : "var(--border)",
                  position: "relative",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "3rem" }}>
                  {d.title || "Ohne Titel"}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  {d.channel} · {new Date(d.savedAt).toLocaleDateString("de-AT")}
                </div>
                <div style={{ position: "absolute", top: "0.4rem", right: "0.4rem", display: "flex", gap: "0.1rem" }}>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      const date = prompt("Datum (JJJJ-MM-TT):", new Date().toISOString().split("T")[0]);
                      if (!date) return;
                      const planItems = getLS<PlannerItem[]>("dh_planner", []);
                      const newItem: PlannerItem = {
                        id: Date.now().toString(36),
                        date,
                        channel: d.channel || "Blog",
                        title: d.title || "Ohne Titel",
                        status: "Geplant",
                        draftId: d.id,
                      };
                      setLS("dh_planner", [...planItems, newItem]);
                      alert(`"${d.title || "Ohne Titel"}" wurde für ${date} eingeplant!`);
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1, padding: "0.1rem 0.2rem" }}
                    title="Im Planer einplanen"
                  >
                    📅
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteDraft(d.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1, padding: "0.1rem 0.25rem" }}
                    title="Draft löschen"
                    aria-label="Draft löschen"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 0 }}>
          {/* Title + controls */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ flex: 1, fontSize: "1rem", fontWeight: 600 }}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titel…"
            />
            <select className="select" value={channel} onChange={e => setChannel(e.target.value)}>
              {CHANNELS.map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={exportMd}>📥 .md</button>
            <button className="btn btn-ghost btn-sm" onClick={copyText}>{copied ? "✓ Kopiert" : "📋 Kopieren"}</button>
            {autosaveIndicator && (
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", alignSelf: "center", whiteSpace: "nowrap" }}>
                Automatisch gespeichert ✓
              </span>
            )}
            <button className="btn btn-primary btn-sm" onClick={saveDraft}>{saved ? "✓ Gespeichert" : "Speichern"}</button>
          </div>

          {/* Toolbar */}
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {TOOLBAR.map(t => (
              <button key={t.label} className="btn btn-ghost btn-sm" onClick={t.action}
                style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Editor panels */}
          <div className="editor-panes" style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", minHeight: 0 }}>
            {/* Textarea */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="section-label" style={{ marginBottom: "0.4rem" }}>Markdown</div>
              <textarea
                ref={textareaRef}
                className="textarea"
                style={{ flex: 1, resize: "none", fontFamily: "monospace", fontSize: "0.85rem", lineHeight: 1.7 }}
                value={content}
                onChange={e => {
                  const val = e.target.value;
                  setContent(val);
                  triggerAutosave(title, val, channel);
                }}
                placeholder="# Überschrift&#10;&#10;Beginne hier zu schreiben…"
              />
            </div>

            {/* Preview */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="section-label" style={{ marginBottom: "0.4rem" }}>Vorschau</div>
              <div className="card" style={{
                flex: 1, overflowY: "auto", padding: "1rem 1.25rem",
                lineHeight: 1.75, fontSize: "0.9rem",
              }}
                dangerouslySetInnerHTML={{ __html: content ? renderMarkdown(content) : "<p style='color:var(--muted)'>Vorschau erscheint hier…</p>" }}
              />
            </div>
          </div>
        </div>
      </div>
    </LoginGate>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorInner />
    </Suspense>
  );
}
