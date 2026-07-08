"use client";
import React, { useState, useEffect, useRef } from "react";
import { getLS, setLS } from "@/lib/storage";
import { scheduleSyncUp } from "@/lib/sync";
import { DAILY_TIPS } from "@/lib/tips";
import { uid } from "@/lib/id";

// ─── Types ────────────────────────────────────────────────────────────────────

type Vision = { my_why: string; my_vision: string; next_goal: string };

type Milestone = {
  id: string; emoji: string; label: string;
  done: boolean; doneAt?: string; custom?: boolean;
};

type Goals = {
  ig_current: number; ig_goal: number;
  nl_current: number; nl_goal: number;
  pin_current: number; pin_goal: number;
  milestones: Milestone[];
};

type Checkin = {
  date: string; well_done: string; try_next: string; energy: number;
};

type BoardCard = {
  id: string;
  type: "image" | "quote" | "word";
  content: string;       // URL / base64 for images; text for quote/word
  color?: string;        // bg color for text cards
  textColor?: string;
  size?: "sm" | "lg";   // sm=1 col, lg=2 cols
  createdAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MILESTONES: Milestone[] = [
  { id: "ig100",   emoji: "🌱", label: "Erste 100 Instagram-Follower",        done: false },
  { id: "ig500",   emoji: "🌿", label: "500 Instagram-Follower",              done: false },
  { id: "ig1k",    emoji: "🌳", label: "1.000 Instagram-Follower",            done: false },
  { id: "ig5k",    emoji: "🚀", label: "5.000 Instagram-Follower",            done: false },
  { id: "blog1",   emoji: "✍️",  label: "Ersten Blog-Artikel veröffentlicht", done: false },
  { id: "blog10",  emoji: "📚", label: "10 Blog-Artikel veröffentlicht",      done: false },
  { id: "nl50",    emoji: "📧", label: "50 Newsletter-Abonnenten",            done: false },
  { id: "nl100",   emoji: "📬", label: "100 Newsletter-Abonnenten",           done: false },
  { id: "collab1", emoji: "🤝", label: "Erste Kooperation / Sponsored Post",  done: false },
  { id: "income1", emoji: "💰", label: "Erster Monat mit Einnahmen",          done: false },
  { id: "prod1",   emoji: "🛍️", label: "Erstes digitales Produkt erstellt",   done: false },
  { id: "prod2",   emoji: "🎉", label: "Erstes Produkt verkauft",             done: false },
  { id: "pin10k",  emoji: "📌", label: "Pinterest: 10.000 Monthly Views",     done: false },
];

const DEFAULT_GOALS: Goals = {
  ig_current: 0, ig_goal: 1000,
  nl_current: 0, nl_goal: 100,
  pin_current: 0, pin_goal: 10000,
  milestones: DEFAULT_MILESTONES,
};

const BOARD_COLORS = [
  { bg: "#f9f0e8", text: "#6b3f28", label: "Warm" },
  { bg: "#e8f0e8", text: "#2d4a2d", label: "Sage" },
  { bg: "#e8edf9", text: "#1e3060", label: "Blue" },
  { bg: "#f9e8f0", text: "#6b2848", label: "Rose" },
  { bg: "#f5f0e0", text: "#5c4b10", label: "Gold" },
  { bg: "#2d2d2d", text: "#f0ebe3", label: "Dark" },
  { bg: "#c4704a", text: "#fff8f0", label: "Terra" },
  { bg: "#587857", text: "#f0f7f0", label: "Forest" },
];


// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 72, stroke = 6, color = "var(--accent)" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - Math.min(1, pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

// ─── Vision Board Card ────────────────────────────────────────────────────────

function BoardCardEl({ card, onDelete }: { card: BoardCard; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const colSpan = card.size === "lg" ? 2 : 1;

  function renderContent() {
    if (card.type === "image") {
      if (imgError) {
        return (
          <div style={{
            width: "100%", height: "100%", minHeight: 180,
            background: "var(--surface2)", border: "1px dashed var(--border)",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: "0.4rem",
          }}>
            <span style={{ fontSize: "1.5rem" }}>🖼️</span>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)", textAlign: "center", padding: "0 0.5rem" }}>
              Bild konnte nicht geladen werden
            </span>
          </div>
        );
      }
      return (
        <>
          <img src={card.content} alt="" style={{ display: "none" }}
            onError={() => setImgError(true)} onLoad={() => setImgError(false)} />
          <div style={{
            width: "100%", height: "100%", minHeight: 180,
            backgroundImage: `url(${card.content})`,
            backgroundSize: "cover", backgroundPosition: "center",
          }} />
        </>
      );
    }
    if (card.type === "quote") {
      return (
        <div style={{
          width: "100%", height: "100%", minHeight: 160,
          background: card.color || "#f9f0e8",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1.25rem",
        }}>
          <p style={{
            color: card.textColor || "#6b3f28",
            fontSize: card.size === "lg" ? "1.05rem" : "0.9rem",
            lineHeight: 1.65, fontStyle: "italic",
            textAlign: "center", margin: 0,
            fontFamily: "var(--font-serif)",
          }}>
            &ldquo;{card.content}&rdquo;
          </p>
        </div>
      );
    }
    return (
      <div style={{
        width: "100%", height: "100%", minHeight: 140,
        background: card.color || "#2d2d2d",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}>
        <span style={{
          color: card.textColor || "#f0ebe3",
          fontSize: card.size === "lg" ? "2.2rem" : "1.6rem",
          fontWeight: 800, textAlign: "center", lineHeight: 1.2,
          letterSpacing: "-0.02em",
          fontFamily: "var(--font-serif)",
        }}>
          {card.content}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      gridColumn: `span ${colSpan}`,
      borderRadius: "var(--radius-sm)",
      overflow: "hidden",
      position: "relative",
      cursor: "default",
      minHeight: 160,
    }}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}>
      {hovered && (
        <button onClick={onDelete} style={{
          position: "absolute", top: 8, right: 8, zIndex: 10,
          width: 28, height: 28, borderRadius: "50%",
          background: "rgba(0,0,0,0.55)", color: "#fff",
          border: "none", cursor: "pointer", fontSize: "0.9rem",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}>×</button>
      )}
      {renderContent()}
    </div>
  );
}

// ─── Add Card Modal ───────────────────────────────────────────────────────────

function AddCardModal({ onClose, onAdd }: { onClose: () => void; onAdd: (card: BoardCard) => void }) {
  const [type, setType] = useState<BoardCard["type"]>("image");
  const [content, setContent] = useState("");
  const [color, setColor] = useState(BOARD_COLORS[0].bg);
  const [textColor, setTextColor] = useState(BOARD_COLORS[0].text);
  const [size, setSize] = useState<BoardCard["size"]>("sm");
  const [imageMode, setImageMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleColorPick(c: typeof BOARD_COLORS[0]) {
    setColor(c.bg);
    setTextColor(c.text);
  }

  // Bild clientseitig verkleinern (max. 1280 px) + als JPEG komprimieren.
  // Hält die Base64-Größe klein, damit localStorage nicht überläuft.
  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1280;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas nicht verfügbar")); return; }
        ctx.drawImage(img, 0, 0, width, height);

        // Byte-Größe der Base64-Nutzlast schätzen
        const bytesOf = (dataUrl: string) => Math.ceil((dataUrl.split(",")[1]?.length || 0) * 0.75);
        const LIMIT = 300 * 1024; // 300 KB
        let out = canvas.toDataURL("image/jpeg", 0.8);
        if (bytesOf(out) > LIMIT) out = canvas.toDataURL("image/jpeg", 0.6);
        if (bytesOf(out) > LIMIT) { reject(new Error("zu groß")); return; }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bild konnte nicht gelesen werden")); };
      img.src = url;
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Bitte eine Bilddatei wählen.");
      return;
    }
    setUploading(true);
    try {
      const b64 = await compressImage(file);
      setContent(b64);
      setPreview(b64);
    } catch (err) {
      if ((err as Error).message === "zu groß") {
        alert("Dieses Bild ist auch nach der Komprimierung zu groß. Bitte ein kleineres Motiv wählen oder die URL-Option nutzen.");
      } else {
        alert("Das Bild konnte nicht verarbeitet werden. Bitte ein anderes wählen.");
      }
    } finally {
      setUploading(false);
    }
  }

  function handleAdd() {
    const trimmed = content.trim();
    if (!trimmed) return;
    onAdd({
      id: uid(),
      type, content: trimmed,
      color: type !== "image" ? color : undefined,
      textColor: type !== "image" ? textColor : undefined,
      size, createdAt: new Date().toISOString(),
    });
    onClose();
  }

  const valid = content.trim().length > 0;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
        border: "1px solid var(--border)",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem 1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>✨ Karte hinzufügen</div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: "1.25rem", padding: "0.25rem",
          }}>×</button>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {/* Type selector */}
          <div>
            <div className="label" style={{ marginBottom: "0.5rem" }}>Art der Karte</div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {([
                { key: "image", icon: "🖼️", label: "Bild" },
                { key: "quote", icon: "💬", label: "Zitat" },
                { key: "word",  icon: "✨", label: "Affirmation" },
              ] as const).map(t => (
                <button key={t.key} onClick={() => { setType(t.key); setContent(""); setPreview(""); }}
                  style={{
                    flex: 1, padding: "0.6rem 0.5rem", borderRadius: "var(--radius-sm)",
                    border: type === t.key ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: type === t.key ? "var(--accent-light)" : "var(--surface2)",
                    cursor: "pointer", fontSize: "0.82rem", fontWeight: type === t.key ? 700 : 400,
                    color: type === t.key ? "var(--accent2)" : "var(--text)",
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Image input */}
          {type === "image" && (
            <div>
              <div className="label" style={{ marginBottom: "0.5rem" }}>Bild</div>
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
                <button onClick={() => { setImageMode("url"); setContent(""); setPreview(""); }}
                  className={imageMode === "url" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>
                  🔗 URL einfügen
                </button>
                <button onClick={() => { setImageMode("upload"); setContent(""); setPreview(""); }}
                  className={imageMode === "upload" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>
                  📁 Hochladen
                </button>
              </div>
              {imageMode === "url" ? (
                <input className="input" value={content}
                  onChange={e => { setContent(e.target.value); setPreview(e.target.value); }}
                  placeholder="https://… (Pinterest, Unsplash, eigene URL)"
                />
              ) : (
                <>
                  <input ref={fileRef} type="file" accept="image/*"
                    style={{ display: "none" }} onChange={handleFileUpload} />
                  <button className="btn btn-secondary" style={{ width: "100%" }}
                    onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? "Wird verarbeitet…" : "📁 Bild vom Gerät wählen"}
                  </button>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.4rem", textAlign: "center" }}>
                    Wird automatisch verkleinert &amp; komprimiert
                  </p>
                </>
              )}
              {preview && (
                <div style={{
                  marginTop: "0.75rem", height: 140, borderRadius: "var(--radius-sm)",
                  backgroundImage: `url(${preview})`, backgroundSize: "cover",
                  backgroundPosition: "center", border: "1px solid var(--border)",
                }} />
              )}
            </div>
          )}

          {/* Quote input */}
          {type === "quote" && (
            <div>
              <label className="label">Zitat oder Satz</label>
              <textarea className="input" rows={3} value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Ich bin stark genug für diesen Weg…"
                style={{ resize: "vertical", fontFamily: "var(--font-serif)" }}
              />
            </div>
          )}

          {/* Word/Affirmation input */}
          {type === "word" && (
            <div>
              <label className="label">Wort oder kurze Phrase</label>
              <input className="input" value={content} onChange={e => setContent(e.target.value)}
                placeholder="FREEDOM · ABUNDANCE · ICH SCHAFF DAS"
                style={{ fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.02em" }}
              />
            </div>
          )}

          {/* Color picker for text cards */}
          {type !== "image" && (
            <div>
              <div className="label" style={{ marginBottom: "0.5rem" }}>Farbe</div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {BOARD_COLORS.map(c => (
                  <button key={c.bg} onClick={() => handleColorPick(c)}
                    title={c.label}
                    style={{
                      width: 32, height: 32, borderRadius: "var(--radius-sm)",
                      background: c.bg, border: color === c.bg ? "2px solid var(--text)" : "1px solid var(--border)",
                      cursor: "pointer", transition: "transform 0.1s",
                      transform: color === c.bg ? "scale(1.15)" : "scale(1)",
                    }} />
                ))}
              </div>
              {/* Live preview */}
              {content && (
                <div style={{
                  marginTop: "0.75rem", padding: "1rem",
                  background: color, borderRadius: "var(--radius-sm)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  minHeight: 80, border: "1px solid var(--border)",
                }}>
                  <span style={{
                    color: textColor,
                    fontFamily: "var(--font-serif)",
                    fontSize: type === "word" ? "1.5rem" : "0.9rem",
                    fontWeight: type === "word" ? 800 : 400,
                    fontStyle: type === "quote" ? "italic" : "normal",
                    textAlign: "center",
                  }}>
                    {type === "quote" ? `"${content}"` : content}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Size picker */}
          <div>
            <div className="label" style={{ marginBottom: "0.5rem" }}>Kartengröße</div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {([
                { key: "sm", icon: "▪", label: "Klein (1×1)" },
                { key: "lg", icon: "▬", label: "Groß (2×1)" },
              ] as const).map(s => (
                <button key={s.key} onClick={() => setSize(s.key)}
                  style={{
                    flex: 1, padding: "0.6rem", borderRadius: "var(--radius-sm)",
                    border: size === s.key ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: size === s.key ? "var(--accent-light)" : "var(--surface2)",
                    cursor: "pointer", fontSize: "0.82rem", fontWeight: size === s.key ? 700 : 400,
                    color: size === s.key ? "var(--accent2)" : "var(--text)",
                  }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.5rem", paddingTop: "0.25rem" }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}
              onClick={handleAdd} disabled={!valid}>
              Karte hinzufügen
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VisionPage() {
  const [board, setBoard] = useState<BoardCard[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [vision, setVision] = useState<Vision>({ my_why: "", my_vision: "", next_goal: "" });
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [visionSaved, setVisionSaved] = useState(false);
  const [goalsSaved, setGoalsSaved] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinForm, setCheckinForm] = useState({ well_done: "", try_next: "", energy: 3 });
  const [showCheckinHistory, setShowCheckinHistory] = useState(false);
  const todayTip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];
  const daysSinceCheckin = (() => {
    if (!checkins.length) return 999;
    const last = new Date(checkins[0].date).getTime();
    return Math.floor((Date.now() - last) / 86400000);
  })();

  useEffect(() => {
    setBoard(getLS<BoardCard[]>("dh_vision_board", []));
    setVision(getLS<Vision>("dh_vision", { my_why: "", my_vision: "", next_goal: "" }));
    const saved = getLS<Goals | null>("dh_goals", null);
    if (saved) {
      const existingIds = new Set(saved.milestones.map(m => m.id));
      const merged = [...saved.milestones, ...DEFAULT_MILESTONES.filter(m => !existingIds.has(m.id))];
      setGoals({ ...DEFAULT_GOALS, ...saved, milestones: merged });
    }
    setCheckins(getLS<Checkin[]>("dh_checkins", []));
  }, []);

  function saveBoard(updated: BoardCard[]) {
    setBoard(updated);
    const ok = setLS("dh_vision_board", updated);
    if (!ok) {
      alert("Speicher voll — das Board konnte nicht gesichert werden. Bitte entferne einige Bilder.");
      return;
    }
    scheduleSyncUp(2000);
  }

  function addCard(card: BoardCard) {
    saveBoard([...board, card]);
  }

  function deleteCard(id: string) {
    saveBoard(board.filter(c => c.id !== id));
  }

  function saveVision() {
    setLS("dh_vision", vision);
    scheduleSyncUp(2000);
    setVisionSaved(true);
    setTimeout(() => setVisionSaved(false), 2500);
  }

  function saveGoals(updated: Goals) {
    setGoals(updated);
    setLS("dh_goals", updated);
    scheduleSyncUp(2000);
    setGoalsSaved(true);
    setTimeout(() => setGoalsSaved(false), 2000);
  }

  function toggleMilestone(id: string) {
    const updated = {
      ...goals,
      milestones: goals.milestones.map(m =>
        m.id === id ? { ...m, done: !m.done, doneAt: !m.done ? new Date().toISOString() : undefined } : m
      ),
    };
    saveGoals(updated);
  }

  function addCustomMilestone() {
    const label = newMilestone.trim();
    if (!label) return;
    const m: Milestone = { id: `custom-${Date.now()}`, emoji: "⭐", label, done: false, custom: true };
    saveGoals({ ...goals, milestones: [...goals.milestones, m] });
    setNewMilestone("");
  }

  function submitCheckin() {
    if (!checkinForm.well_done.trim() && !checkinForm.try_next.trim()) return;
    const entry: Checkin = { date: new Date().toISOString(), ...checkinForm };
    const updated = [entry, ...checkins].slice(0, 52);
    setCheckins(updated);
    setLS("dh_checkins", updated);
    scheduleSyncUp(2000);
    setCheckinDone(true);
    setCheckinForm({ well_done: "", try_next: "", energy: 3 });
  }

  const doneMilestones = goals.milestones.filter(m => m.done).length;
  const totalMilestones = goals.milestones.length;

  return (
    <>
      <div style={{ maxWidth: 720 }}>

        {showAddCard && (
          <AddCardModal onClose={() => setShowAddCard(false)} onAdd={addCard} />
        )}

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1>🌟 Mein Northstar</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.25rem" }}>
            Dein Warum, deine Ziele, dein Weg.
          </p>
        </div>

        {/* ── Vision Board ────────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", margin: 0 }}>🎨 Vision Board</h2>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                Bilder, Zitate und Affirmationen die dich täglich erinnern, wofür du das alles machst.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddCard(true)}>
              + Karte
            </button>
          </div>

          {board.length === 0 ? (
            <div style={{
              border: "2px dashed var(--border)", borderRadius: "var(--radius-sm)",
              padding: "2.5rem 1.5rem", textAlign: "center",
            }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🖼️</div>
              <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "0.4rem" }}>
                Dein Board ist noch leer
              </div>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
                Füge Bilder von Pinterest oder Unsplash hinzu, schreibe dein Lieblingsz­itat oder
                deine stärkste Affirmation — was auch immer dich inspiriert.
              </p>
              <button className="btn btn-primary" onClick={() => setShowAddCard(true)}>
                ✨ Erste Karte hinzufügen
              </button>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem",
            }}>
              {board.map(card => (
                <BoardCardEl key={card.id} card={card} onDelete={() => deleteCard(card.id)} />
              ))}
              {/* Add card tile */}
              <button onClick={() => setShowAddCard(true)} style={{
                minHeight: 120, borderRadius: "var(--radius-sm)",
                border: "2px dashed var(--border)", background: "var(--surface2)",
                cursor: "pointer", color: "var(--muted)", fontSize: "0.82rem",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: "0.3rem", transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--muted)"; }}>
                <span style={{ fontSize: "1.5rem" }}>+</span>
                <span>Karte</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Mein Warum & Vision ─────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>💜 Mein Warum</h2>
            <button className="btn btn-primary btn-sm" onClick={saveVision}>
              {visionSaved ? "✓ Gespeichert" : "Speichern"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="label">Warum mache ich das? Was treibt mich an?</label>
              <textarea className="input" rows={3} value={vision.my_why}
                onChange={e => setVision(p => ({ ...p, my_why: e.target.value }))}
                placeholder="Ich mache das weil... Mich bewegt... Für mich bedeutet das..."
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <div>
              <label className="label">Meine Vision — Wie sieht mein Leben in 1 Jahr aus?</label>
              <textarea className="input" rows={3} value={vision.my_vision}
                onChange={e => setVision(p => ({ ...p, my_vision: e.target.value }))}
                placeholder="In einem Jahr habe ich... Ich helfe... Ich verdiene... Ich fühle mich..."
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <div>
              <label className="label">Mein nächstes konkretes Ziel</label>
              <input className="input" value={vision.next_goal}
                onChange={e => setVision(p => ({ ...p, next_goal: e.target.value }))}
                placeholder="z.B. Bis 31. Juli meine erste Kooperation anfragen"
              />
            </div>
          </div>

          {vision.my_why && (
            <div style={{
              marginTop: "1.25rem", padding: "1rem 1.25rem",
              background: "var(--accent-light)", borderRadius: "var(--radius-sm)",
              borderLeft: "3px solid var(--accent)", fontSize: "0.88rem",
              color: "var(--text)", fontStyle: "italic", lineHeight: 1.7,
            }}>
              &ldquo;{vision.my_why}&rdquo;
            </div>
          )}
        </div>

        {/* ── Ziele & Fortschritt ──────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>🎯 Meine Ziele</h2>
            {goalsSaved && <span style={{ fontSize: "0.8rem", color: "var(--sage)" }}>✓ Gespeichert</span>}
          </div>

          <div className="grid-3" style={{ gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Instagram", icon: "📱", cur: goals.ig_current, curKey: "ig_current" as const, goal: goals.ig_goal, goalKey: "ig_goal" as const, color: "var(--accent)" },
              { label: "Newsletter", icon: "📧", cur: goals.nl_current, curKey: "nl_current" as const, goal: goals.nl_goal, goalKey: "nl_goal" as const, color: "var(--gold)" },
              { label: "Pinterest Views", icon: "📌", cur: goals.pin_current, curKey: "pin_current" as const, goal: goals.pin_goal, goalKey: "pin_goal" as const, color: "var(--warm-red)" },
            ].map(channel => {
              const pct = channel.goal > 0 ? Math.round((channel.cur / channel.goal) * 100) : 0;
              return (
                <div key={channel.label} style={{ textAlign: "center" }}>
                  <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <ProgressRing pct={pct} size={88} stroke={7} color={channel.color} />
                    <div style={{ position: "absolute", fontWeight: 700, fontSize: "1rem", color: channel.color }}>{pct}%</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", marginTop: "0.4rem" }}>{channel.icon} {channel.label}</div>
                  <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", justifyContent: "center", marginTop: "0.4rem" }}>
                    <input type="number" className="input" value={channel.cur || ""}
                      onChange={e => saveGoals({ ...goals, [channel.curKey]: Number(e.target.value) || 0 })}
                      placeholder="Aktuell" min={0}
                      style={{ width: 70, textAlign: "center", fontSize: "0.78rem", padding: "0.3rem" }}
                    />
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>/</span>
                    <input type="number" className="input" value={channel.goal || ""}
                      onChange={e => saveGoals({ ...goals, [channel.goalKey]: Number(e.target.value) || 0 })}
                      placeholder="Ziel" min={0}
                      style={{ width: 70, textAlign: "center", fontSize: "0.78rem", padding: "0.3rem" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Milestones */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Meilensteine — {doneMilestones}/{totalMilestones} erreicht
              </div>
              {doneMilestones > 0 && (
                <span style={{ fontSize: "0.75rem", color: "var(--sage)" }}>
                  🎉 {Math.round((doneMilestones / totalMilestones) * 100)}% geschafft!
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
              {goals.milestones.map(m => (
                <label key={m.id} style={{
                  display: "flex", alignItems: "center", gap: "0.65rem",
                  padding: "0.55rem 0.75rem", borderRadius: "var(--radius-sm)",
                  cursor: "pointer", transition: "background 0.15s",
                  background: m.done ? "var(--accent-light)" : "var(--surface2)",
                  border: m.done ? "1px solid rgba(196,112,74,0.2)" : "1px solid transparent",
                }}>
                  <input type="checkbox" checked={m.done} onChange={() => toggleMilestone(m.id)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: "1.1rem" }}>{m.emoji}</span>
                  <span style={{
                    fontSize: "0.85rem", flex: 1,
                    textDecoration: m.done ? "line-through" : "none",
                    color: m.done ? "var(--muted)" : "var(--text)",
                  }}>{m.label}</span>
                  {m.done && m.doneAt && (
                    <span style={{ fontSize: "0.7rem", color: "var(--sage)", flexShrink: 0 }}>
                      ✓ {new Date(m.doneAt).toLocaleDateString("de-AT", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="input" value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
                placeholder="Eigenen Meilenstein hinzufügen…" style={{ flex: 1 }}
                onKeyDown={e => { if (e.key === "Enter") addCustomMilestone(); }}
              />
              <button className="btn btn-secondary btn-sm" onClick={addCustomMilestone} disabled={!newMilestone.trim()}>
                + Hinzufügen
              </button>
            </div>
          </div>
        </div>

        {/* ── Heutiger Tipp ────────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1.5rem", background: "var(--accent-light)", border: "1px solid rgba(196,112,74,0.2)" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "var(--radius-sm)",
              background: "var(--accent)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "1.4rem", flexShrink: 0,
            }}>
              {todayTip.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--accent2)" }}>
                  Tipp des Tages
                </div>
                <span className="badge badge-terra" style={{ fontSize: "0.68rem" }}>{todayTip.cat}</span>
              </div>
              <p style={{ fontSize: "0.88rem", lineHeight: 1.65, color: "var(--text)", margin: 0 }}>
                {todayTip.tip}
              </p>
            </div>
          </div>
          <p style={{ fontSize: "0.7rem", color: "var(--accent)", marginTop: "0.85rem", marginBottom: 0, textAlign: "right" }}>
            Täglich ein neuer Tipp · Heute ist Tag {new Date().getDate()} im Monat
          </p>
        </div>

        {/* ── Wöchentliches Check-in ───────────────────────────────────────── */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", margin: 0 }}>📓 Wöchentliches Check-in</h2>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                {checkins.length > 0
                  ? `Letztes Check-in: ${new Date(checkins[0].date).toLocaleDateString("de-AT", { day: "2-digit", month: "long" })} · ${daysSinceCheckin < 7 ? `vor ${daysSinceCheckin} Tag${daysSinceCheckin !== 1 ? "en" : ""}` : "vor mehr als einer Woche"}`
                  : "Noch kein Check-in — starte jetzt"}
              </p>
            </div>
            {checkins.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCheckinHistory(!showCheckinHistory)}>
                {showCheckinHistory ? "Schließen" : `Verlauf (${checkins.length})`}
              </button>
            )}
          </div>

          {showCheckinHistory && checkins.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              {checkins.slice(0, 8).map((c, i) => (
                <div key={i} style={{
                  padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
                  background: "var(--surface2)", marginBottom: "0.4rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>
                      {new Date(c.date).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: "0.9rem" }}>{"⭐".repeat(c.energy)}{"☆".repeat(5 - c.energy)}</span>
                  </div>
                  {c.well_done && <p style={{ fontSize: "0.82rem", color: "var(--text)", margin: "0 0 0.2rem" }}>✅ {c.well_done}</p>}
                  {c.try_next && <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>💡 {c.try_next}</p>}
                </div>
              ))}
            </div>
          )}

          {checkinDone ? (
            <div style={{
              padding: "1rem 1.25rem", background: "rgba(88,129,87,0.1)",
              borderRadius: "var(--radius-sm)", textAlign: "center",
              border: "1px solid rgba(88,129,87,0.2)",
            }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>🌿</div>
              <div style={{ fontWeight: 600, color: "var(--sage)" }}>Check-in gespeichert!</div>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                Bis nächste Woche. Du machst das großartig.
              </p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: "0.75rem" }} onClick={() => setCheckinDone(false)}>
                Neues Check-in
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label className="label">Was lief diese Woche gut? ✅</label>
                <textarea className="input" rows={2} value={checkinForm.well_done}
                  onChange={e => setCheckinForm(p => ({ ...p, well_done: e.target.value }))}
                  placeholder="Ein Post hat super performt, ich habe meine Posting-Ziele erreicht, eine tolle Anfrage bekommen…"
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label className="label">Was probiere ich nächste Woche aus? 💡</label>
                <textarea className="input" rows={2} value={checkinForm.try_next}
                  onChange={e => setCheckinForm(p => ({ ...p, try_next: e.target.value }))}
                  placeholder="Ich teste einen neuen Posting-Zeitpunkt, ich versuche mehr Stories, ich schreibe einen langen Caption…"
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label className="label">Energie & Motivation diese Woche</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setCheckinForm(p => ({ ...p, energy: n }))}
                      style={{
                        width: 44, height: 44, borderRadius: "var(--radius-sm)",
                        border: checkinForm.energy === n ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: checkinForm.energy === n ? "var(--accent-light)" : "var(--surface2)",
                        cursor: "pointer", fontSize: "1.2rem",
                      }}>
                      {["😴", "😕", "😊", "💪", "🔥"][n - 1]}
                    </button>
                  ))}
                  <span style={{ alignSelf: "center", fontSize: "0.82rem", color: "var(--muted)", marginLeft: "0.25rem" }}>
                    {["Erschöpft", "Holprig", "Gut", "Stark", "Auf Feuer"][checkinForm.energy - 1]}
                  </span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={submitCheckin}
                disabled={!checkinForm.well_done.trim() && !checkinForm.try_next.trim()}
                style={{ alignSelf: "flex-start" }}>
                Check-in speichern →
              </button>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
