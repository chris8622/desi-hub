"use client";
import { useState, useEffect } from "react";
import { scheduleSyncUp } from "@/lib/sync";
import Link from "next/link";
import LoginGate from "@/components/LoginGate";

type PlannerItem = { id: string; date: string; channel: string; title: string; status: string; draftId?: string };
type ModalData = { date: string; item?: PlannerItem };
type Draft = { id: string; title: string; content: string; channel: string; savedAt: string };

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

const CHANNELS = ["Instagram", "Pinterest", "Blog", "Newsletter", "Sonstiges"];
const STATUSES = ["Entwurf", "Geplant", "Veröffentlicht"];
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const CHANNEL_COLOR: Record<string, { bg: string; text: string }> = {
  Instagram: { bg: "var(--accent-light)", text: "var(--accent2)" },
  Pinterest: { bg: "var(--warm-red-light)", text: "var(--warm-red)" },
  Blog: { bg: "var(--sage-light)", text: "var(--sage)" },
  Newsletter: { bg: "var(--gold-light)", text: "var(--gold)" },
  Sonstiges: { bg: "var(--surface2)", text: "var(--muted)" },
};

function startOfWeek(d: Date): Date {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // strip time
  const day = dt.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // distance to Monday
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function PlannerPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [modal, setModal] = useState<ModalData | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formChannel, setFormChannel] = useState("Instagram");
  const [formStatus, setFormStatus] = useState("Geplant");
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoMsg, setAutoMsg] = useState("");
  const [formDraftId, setFormDraftId] = useState<string>("");
  const [availableDrafts, setAvailableDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    const loadedItems = getLS<PlannerItem[]>("dh_planner", []);
    setItems(loadedItems);
    setAvailableDrafts(getLS<Draft[]>("dh_drafts", []));

    // Auto-fill week if auto_plan is enabled and this week is empty
    const settings = getLS<{ auto_plan?: boolean; groq_key?: string }>("dh_settings", {});
    if (settings.auto_plan !== false && settings.groq_key) {
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart); d.setDate(d.getDate() + i);
        return d.toISOString().split("T")[0];
      });
      const existingThisWeek = loadedItems.filter(it => weekDates.includes(it.date));
      if (existingThisWeek.length === 0) {
        // Run in background — do not await, do not block UI
        setTimeout(() => { autoFillWeek(); }, 100);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function autoFillWeek() {
    const settings = getLS("dh_settings", {
      topics: ["Mindset", "Hormongesundheit", "Hautpflege", "Morgenroutine"],
      voice: "warm-inspirierend", niche: "Mind, Health & Ästhetik",
      freq_instagram: 4, freq_pinterest: 2, freq_blog: 1, freq_newsletter: 1,
    });
    const groqKey = (settings as { groq_key?: string }).groq_key || "";
    setAutoLoading(true); setAutoMsg("KI erstellt deinen Wochenplan…");
    try {
      const res = await fetch("/api/autoplan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-token": localStorage.getItem("desi_auth_token") || "" },
        body: JSON.stringify({ settings, weekStart: formatDate(weekStart), groqKey }),
      });
      const data = await res.json() as { plan?: PlannerItem[]; error?: string };
      if (data.error) { setAutoMsg("⚠️ " + data.error); return; }
      // Nur neue Slots hinzufügen (bestehende behalten)
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart); d.setDate(d.getDate() + i);
        return formatDate(d);
      });
      const existing = items.filter(it => weekDates.includes(it.date));
      const existingDates = existing.map(it => `${it.date}-${it.channel}`);
      const newItems = (data.plan ?? []).filter(p => !existingDates.includes(`${p.date}-${p.channel}`));
      const updated = [...items.filter(it => !weekDates.includes(it.date)), ...existing, ...newItems];
      save(updated);
      setAutoMsg(`✓ ${newItems.length} neue Posts eingeplant!`);
    } catch (e) {
      setAutoMsg("⚠️ " + (e as Error).message);
    } finally {
      setAutoLoading(false);
      setTimeout(() => setAutoMsg(""), 4000);
    }
  }

  const save = (updated: PlannerItem[]) => {
    setItems(updated);
    setLS("dh_planner", updated);
    scheduleSyncUp(3000);
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const openAddModal = (date: string) => {
    setFormTitle(""); setFormChannel("Instagram"); setFormStatus("Geplant"); setFormDraftId("");
    setModal({ date });
  };

  const openEditModal = (item: PlannerItem) => {
    setFormTitle(item.title); setFormChannel(item.channel); setFormStatus(item.status); setFormDraftId(item.draftId || "");
    setModal({ date: item.date, item });
  };

  const submitModal = () => {
    if (!formTitle.trim() || !modal) return;
    const draftId = formDraftId || undefined;
    if (modal.item) {
      save(items.map(i => i.id === modal.item!.id
        ? { ...i, title: formTitle, channel: formChannel, status: formStatus, draftId }
        : i));
    } else {
      save([...items, { id: crypto.randomUUID(), date: modal.date, title: formTitle, channel: formChannel, status: formStatus, draftId }]);
    }
    setModal(null);
  };

  const deleteItem = (id: string) => {
    save(items.filter(i => i.id !== id));
    setModal(null);
  };

  const today = formatDate(new Date());
  const weekEnd = weekDays[6];
  const monthLabel = (() => {
    if (weekStart.getMonth() !== weekEnd.getMonth()) {
      const startMon = weekStart.toLocaleDateString("de-AT", { month: "short" });
      const endMon = weekEnd.toLocaleDateString("de-AT", { month: "short" });
      const year = weekEnd.getFullYear();
      return `${startMon} – ${endMon} ${year}`;
    }
    return weekStart.toLocaleDateString("de-AT", { month: "long", year: "numeric" });
  })();

  return (
    <LoginGate>
      <div>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Planer 📅</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Dein Redaktionsplan auf einen Blick</p>
        </div>

        {/* Week navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.65rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={prevWeek}>← Vorherige</button>
            <button className="btn btn-ghost btn-sm" onClick={goToday}>Heute</button>
            <button className="btn btn-secondary btn-sm" onClick={nextWeek}>Nächste →</button>
            <button className="btn btn-primary btn-sm" onClick={autoFillWeek} disabled={autoLoading}
              style={{ marginLeft: "0.5rem" }}>
              {autoLoading ? "⏳ Erstelle…" : "✨ Auto-Wochenplan"}
            </button>
            {autoMsg && <span style={{ fontSize: "0.8rem", color: autoMsg.startsWith("⚠") ? "var(--warm-red)" : "var(--sage)", fontWeight: 600 }}>{autoMsg}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{monthLabel}</div>
            {/* Legend */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {CHANNELS.map(ch => (
                <div key={ch} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: CHANNEL_COLOR[ch].text }} />
                  {ch}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="planner-week-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.5rem" }}>
          {weekDays.map((day, i) => {
            const dateStr = formatDate(day);
            const dayItems = items.filter(it => it.date === dateStr);
            const isToday = dateStr === today;

            return (
              <div key={dateStr} style={{
                background: isToday ? "var(--accent-light)" : "var(--surface)",
                border: `1px solid ${isToday ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                padding: "0.75rem",
                minHeight: 160,
                display: "flex", flexDirection: "column", gap: "0.4rem",
              }}>
                {/* Day header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 500 }}>{DAYS[i]}</div>
                    <div style={{
                      fontSize: "1.1rem", fontWeight: 700,
                      color: isToday ? "var(--accent)" : "var(--text)",
                      display: "flex", alignItems: "baseline", gap: "0.3rem",
                    }}>
                      {day.getDate()}
                      <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--muted)" }}>
                        {day.toLocaleDateString("de-AT", { month: "short" })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openAddModal(dateStr)}
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      border: "1px solid var(--border)", background: "none",
                      cursor: "pointer", fontSize: "1rem", color: "var(--muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      lineHeight: 1, flexShrink: 0,
                    }}
                    title="Post hinzufügen"
                    aria-label="Post hinzufügen"
                  >
                    +
                  </button>
                </div>

                {/* Items */}
                {dayItems.map(item => {
                  const colors = CHANNEL_COLOR[item.channel] || CHANNEL_COLOR["Sonstiges"];
                  return (
                    <div
                      key={item.id}
                      onClick={() => openEditModal(item)}
                      style={{
                        background: colors.bg, color: colors.text,
                        borderRadius: "var(--radius-sm)",
                        padding: "0.3rem 0.5rem",
                        fontSize: "0.75rem", fontWeight: 500,
                        cursor: "pointer",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        transition: "opacity 0.15s",
                        display: "flex", alignItems: "center", gap: "0.25rem",
                      }}
                      title={item.title}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>
                      {item.draftId && (
                        <Link
                          href={`/editor?draft=${item.draftId}`}
                          onClick={e => e.stopPropagation()}
                          style={{ color: colors.text, flexShrink: 0, lineHeight: 1 }}
                          title="Draft im Editor öffnen"
                        >
                          ✏️
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Modal */}
        {modal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(44,32,22,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
            padding: "1rem",
          }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          >
            <div className="card" style={{ width: "100%", maxWidth: 420, padding: "1.75rem", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1.25rem" }}>
                {modal.item ? "Post bearbeiten" : "Post hinzufügen"}
                <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                  {new Date(modal.date + "T12:00:00").toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" })}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <label className="label">Titel</label>
                  <input className="input" style={{ width: "100%" }} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Post-Titel…" autoFocus />
                </div>
                <div>
                  <label className="label">Kanal</label>
                  <select className="select" style={{ width: "100%" }} value={formChannel} onChange={e => setFormChannel(e.target.value)}>
                    {CHANNELS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select" style={{ width: "100%" }} value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Draft verknüpfen (optional)</label>
                  <select className="select" style={{ width: "100%" }} value={formDraftId} onChange={e => setFormDraftId(e.target.value)}>
                    <option value="">— Kein Draft —</option>
                    {availableDrafts.map(d => (
                      <option key={d.id} value={d.id}>{d.title || "Ohne Titel"} ({d.channel})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
                {modal.item && (
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--warm-red)", marginRight: "auto" }}
                    onClick={() => deleteItem(modal.item!.id)}>
                    Löschen
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Abbrechen</button>
                <button className="btn btn-primary btn-sm" onClick={submitModal} disabled={!formTitle.trim()}>
                  {modal.item ? "Speichern" : "Hinzufügen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LoginGate>
  );
}
