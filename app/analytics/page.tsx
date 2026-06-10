"use client";
import { useState, useEffect } from "react";
import LoginGate from "@/components/LoginGate";
import { getLS, setLS } from "@/lib/storage";
import { scheduleSyncUp } from "@/lib/sync";

type PlannerItem = { id: string; date: string; channel: string; title: string; status: string };

type AnalyticsEntry = {
  id: string;
  date: string;
  channel: string;
  title: string;
  saves?: number;
  likes?: number;
  comments?: number;
  reach?: number;
  notes?: string;
  loggedAt?: string;
};

const CHANNEL_COLOR: Record<string, { bg: string; text: string }> = {
  Instagram:  { bg: "var(--accent-light)",    text: "var(--accent2)"  },
  Pinterest:  { bg: "var(--warm-red-light)",  text: "var(--warm-red)" },
  Blog:       { bg: "var(--sage-light)",      text: "var(--sage)"     },
  Newsletter: { bg: "var(--gold-light)",      text: "var(--gold)"     },
  Sonstiges:  { bg: "var(--surface2)",        text: "var(--muted)"    },
};

function fmt(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function weekday(d: string) {
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return days[new Date(d).getDay()];
}

function avgNum(arr: (number | undefined)[]): number | null {
  const vals = arr.filter((v): v is number => v !== undefined && v > 0);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<PlannerItem[]>([]);
  const [entries, setEntries] = useState<AnalyticsEntry[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ saves: "", likes: "", comments: "", reach: "", notes: "" });
  const [saved, setSaved] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const planner = getLS<PlannerItem[]>("dh_planner", []);
    const published = planner
      .filter(p => p.status === "Veröffentlicht")
      .sort((a, b) => b.date.localeCompare(a.date));
    setPosts(published);
    setEntries(getLS<AnalyticsEntry[]>("dh_analytics", []));
    setMounted(true);
  }, []);

  if (!mounted) return null;

  function getEntry(id: string): AnalyticsEntry | undefined {
    return entries.find(e => e.id === id);
  }

  function openEdit(post: PlannerItem) {
    const e = getEntry(post.id);
    setForm({
      saves:    e?.saves    != null ? String(e.saves)    : "",
      likes:    e?.likes    != null ? String(e.likes)    : "",
      comments: e?.comments != null ? String(e.comments) : "",
      reach:    e?.reach    != null ? String(e.reach)    : "",
      notes:    e?.notes    ?? "",
    });
    setEditId(post.id);
  }

  function saveEntry(post: PlannerItem) {
    const updated: AnalyticsEntry = {
      id:       post.id,
      date:     post.date,
      channel:  post.channel,
      title:    post.title,
      saves:    form.saves    ? Number(form.saves)    : undefined,
      likes:    form.likes    ? Number(form.likes)    : undefined,
      comments: form.comments ? Number(form.comments) : undefined,
      reach:    form.reach    ? Number(form.reach)    : undefined,
      notes:    form.notes.trim() || undefined,
      loggedAt: new Date().toISOString(),
    };
    const next = [...entries.filter(e => e.id !== post.id), updated];
    setEntries(next);
    setLS("dh_analytics", next);
    scheduleSyncUp(2000);
    setEditId(null);
    setSaved(post.id);
    setTimeout(() => setSaved(null), 2500);
  }

  function deleteEntry(id: string) {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    setLS("dh_analytics", next);
    scheduleSyncUp(2000);
  }

  // ── Insights ─────────────────────────────────────────────
  const logged = entries.filter(e => e.saves != null || e.likes != null || e.reach != null);

  // Bester Kanal (nach Ø Saves)
  const byChannel: Record<string, number[]> = {};
  logged.forEach(e => {
    if (e.saves != null) {
      byChannel[e.channel] = [...(byChannel[e.channel] || []), e.saves];
    }
  });
  const bestChannel = Object.entries(byChannel)
    .map(([ch, vals]) => ({ ch, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }))
    .sort((a, b) => b.avg - a.avg)[0];

  // Bester Wochentag (nach Ø Saves)
  const byDay: Record<string, number[]> = {};
  logged.forEach(e => {
    if (e.saves != null) {
      const d = weekday(e.date);
      byDay[d] = [...(byDay[d] || []), e.saves];
    }
  });
  const bestDay = Object.entries(byDay)
    .map(([d, vals]) => ({ d, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }))
    .sort((a, b) => b.avg - a.avg)[0];

  // Gesamt-Stats
  const totalSaves    = avgNum(logged.map(e => e.saves));
  const totalReach    = avgNum(logged.map(e => e.reach));

  const hasInsights = logged.length >= 2;

  return (
    <LoginGate>
      <div style={{ maxWidth: 860 }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1>📊 Learnings & Analytics</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.25rem" }}>
            Trage Kennzahlen für veröffentlichte Posts ein — und lass das Tool dir zeigen, was funktioniert.
          </p>
        </div>

        {/* Insights */}
        {hasInsights ? (
          <div className="grid-4" style={{ marginBottom: "2rem" }}>
            {bestChannel && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>Bester Kanal</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "var(--accent)", lineHeight: 1 }}>{bestChannel.ch}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.3rem" }}>Ø {bestChannel.avg} Saves</div>
              </div>
            )}
            {bestDay && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>Bester Wochentag</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "var(--sage)", lineHeight: 1 }}>{bestDay.d}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.3rem" }}>Ø {bestDay.avg} Saves</div>
              </div>
            )}
            {totalSaves != null && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>Ø Saves</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "var(--warm-red)", lineHeight: 1 }}>{totalSaves}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.3rem" }}>über alle Kanäle</div>
              </div>
            )}
            {totalReach != null && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>Ø Reichweite</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "var(--gold)", lineHeight: 1 }}>{totalReach.toLocaleString("de-AT")}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.3rem" }}>Personen erreicht</div>
              </div>
            )}
          </div>
        ) : logged.length > 0 ? (
          <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "2rem", background: "var(--gold-light)", border: "1px solid rgba(184,148,80,0.3)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--gold)" }}>
              💡 Trag Kennzahlen für mindestens 2 Posts ein — dann erscheinen hier Insights über deinen besten Kanal, besten Wochentag und mehr.
            </span>
          </div>
        ) : null}

        {/* Posts-Tabelle */}
        {posts.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Noch keine veröffentlichten Posts</div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", maxWidth: 340, textAlign: "center", lineHeight: 1.5 }}>
              Setze Posts im Planer auf „Veröffentlicht" — sie erscheinen dann hier zum Auswerten.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {posts.map(post => {
              const entry   = getEntry(post.id);
              const isEdit  = editId === post.id;
              const isSaved = saved === post.id;
              const cc = CHANNEL_COLOR[post.channel] || CHANNEL_COLOR.Sonstiges;
              const hasData = entry && (entry.saves != null || entry.likes != null || entry.comments != null || entry.reach != null);

              return (
                <div key={post.id} className="card" style={{ padding: "1.1rem 1.25rem" }}>
                  {/* Header-Zeile */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, background: cc.bg, color: cc.text, borderRadius: 999, padding: "0.2rem 0.6rem" }}>
                          {post.channel}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {weekday(post.date)}, {fmt(post.date)}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {post.title}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                      {isSaved ? (
                        <span style={{ fontSize: "0.8rem", color: "var(--sage)", fontWeight: 600 }}>✓ Gespeichert</span>
                      ) : (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => isEdit ? setEditId(null) : openEdit(post)}
                          >
                            {isEdit ? "Abbrechen" : hasData ? "✏️ Bearbeiten" : "＋ Kennzahlen eintragen"}
                          </button>
                          {hasData && !isEdit && (
                            <button
                              onClick={() => deleteEntry(post.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.9rem", padding: "0 0.2rem" }}
                              title="Eintrag löschen"
                            >🗑️</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Gespeicherte Werte anzeigen (nicht im Edit-Modus) */}
                  {hasData && !isEdit && (
                    <div style={{ display: "flex", gap: "1.25rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                      {entry.saves    != null && <Metric icon="📌" label="Saves"     value={entry.saves}    />}
                      {entry.likes    != null && <Metric icon="❤️" label="Likes"     value={entry.likes}    />}
                      {entry.comments != null && <Metric icon="💬" label="Kommentare" value={entry.comments} />}
                      {entry.reach    != null && <Metric icon="👁" label="Reichweite" value={entry.reach}    />}
                      {entry.notes && (
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic", alignSelf: "center" }}>
                          „{entry.notes}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Edit-Formular */}
                  {isEdit && (
                    <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                        {[
                          { key: "saves",    label: "📌 Saves",      placeholder: "z.B. 42" },
                          { key: "likes",    label: "❤️ Likes",      placeholder: "z.B. 130" },
                          { key: "comments", label: "💬 Kommentare", placeholder: "z.B. 8" },
                          { key: "reach",    label: "👁 Reichweite",  placeholder: "z.B. 1200" },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="label" style={{ fontSize: "0.72rem" }}>{f.label}</label>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              placeholder={f.placeholder}
                              value={form[f.key as keyof typeof form]}
                              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                              style={{ fontSize: "0.85rem" }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginBottom: "0.75rem" }}>
                        <label className="label" style={{ fontSize: "0.72rem" }}>📝 Notiz (optional)</label>
                        <input
                          className="input"
                          placeholder="Was hat gut/schlecht funktioniert?"
                          value={form.notes}
                          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEntry(post)}>
                        ✓ Speichern
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LoginGate>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
      <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{icon} {label}</div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: "var(--text)", lineHeight: 1 }}>
        {value.toLocaleString("de-AT")}
      </div>
    </div>
  );
}
