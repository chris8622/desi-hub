"use client";
import { useState, useEffect, useRef } from "react";
import LoginGate from "@/components/LoginGate";

type Subscriber = { id: string; name: string; email: string; addedAt: string };
type Newsletter = { id: string; subject: string; preheader?: string; body: string; createdAt: string };

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

function parseCSV(text: string): { name: string; email: string; addedAt: string }[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
  const emailIdx = header.findIndex(h => h.includes("email"));
  const nameIdx = header.findIndex(h => h.includes("name"));
  const dateIdx = header.findIndex(h => h.includes("date") || h.includes("datum"));

  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
    return {
      email: cols[emailIdx] || cols[1] || "",
      name: cols[nameIdx] || cols[0] || "",
      addedAt: cols[dateIdx] || new Date().toISOString(),
    };
  }).filter(r => r.email.includes("@"));
}

export default function EmailPage() {
  const [tab, setTab] = useState<"subscriber" | "newsletter">("subscriber");

  // Subscriber state
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Newsletter state
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [nlSubject, setNlSubject] = useState("");
  const [nlBody, setNlBody] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setSubscribers(getLS<Subscriber[]>("dh_subscribers", []));
    setNewsletters(getLS<Newsletter[]>("dh_newsletters", []));
  }, []);

  // Subscriber functions
  const saveSubs = (updated: Subscriber[]) => {
    setSubscribers(updated);
    setLS("dh_subscribers", updated);
  };

  const deleteSub = (id: string) => saveSubs(subscribers.filter(s => s.id !== id));

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      const existing = new Set(subscribers.map(s => s.email.toLowerCase()));
      const newSubs: Subscriber[] = parsed
        .filter(r => !existing.has(r.email.toLowerCase()))
        .map(r => ({ id: crypto.randomUUID(), ...r }));
      saveSubs([...subscribers, ...newSubs]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportCSV = () => {
    const rows = [
      ["Name", "E-Mail", "Hinzugefügt"],
      ...subscribers.map(s => [s.name, s.email, new Date(s.addedAt).toLocaleDateString("de-AT")]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "subscriber-export.csv";
    a.click();
  };

  const filteredSubs = subscribers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  const thisMonth = subscribers.filter(s => {
    const d = new Date(s.addedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Newsletter functions
  const saveNLs = (updated: Newsletter[]) => {
    setNewsletters(updated);
    setLS("dh_newsletters", updated);
  };

  const generateNewsletter = async () => {
    if (!nlSubject.trim()) return;
    setNlLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "newsletter", topic: nlSubject }),
      });
      const data = await res.json();
      if (data.body) setNlBody(data.body);
      if (data.subject) setNlSubject(data.subject);
    } catch {}
    setNlLoading(false);
  };

  const saveNewsletter = () => {
    if (!nlSubject.trim()) return;
    const now = new Date().toISOString();
    if (editingId) {
      saveNLs(newsletters.map(n => n.id === editingId ? { ...n, subject: nlSubject, body: nlBody } : n));
    } else {
      saveNLs([{ id: crypto.randomUUID(), subject: nlSubject, body: nlBody, createdAt: now }, ...newsletters]);
    }
    setShowForm(false);
    setNlSubject(""); setNlBody(""); setEditingId(null);
  };

  const editNewsletter = (n: Newsletter) => {
    setNlSubject(n.subject); setNlBody(n.body); setEditingId(n.id); setShowForm(true);
  };

  const deleteNewsletter = (id: string) => saveNLs(newsletters.filter(n => n.id !== id));

  const exportNlMd = (n: Newsletter) => {
    const plain = n.body.replace(/<[^>]+>/g, "");
    const md = `# ${n.subject}\n\n${plain}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `newsletter-${n.subject.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
  };

  return (
    <LoginGate>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>E-Mail 📧</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Subscriber verwalten & Newsletter erstellen</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)" }}>
          {(["subscriber", "newsletter"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "0.6rem 1.25rem", border: "none", background: "none", cursor: "pointer",
              fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--accent)" : "var(--muted)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1, fontSize: "0.9rem",
            }}>
              {t === "subscriber" ? "👥 Subscriber" : "✉️ Newsletter"}
            </button>
          ))}
        </div>

        {/* Subscriber tab */}
        {tab === "subscriber" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)" }}>{subscribers.length}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Subscriber gesamt</div>
              </div>
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--sage)" }}>{thisMonth}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Diesen Monat hinzugefügt</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Suchen nach Name oder E-Mail…"
              />
              <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={importCSV} />
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                📂 CSV importieren
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={!subscribers.length}>
                📥 CSV exportieren
              </button>
            </div>

            {/* Table */}
            {filteredSubs.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
                <div>{search ? "Keine Ergebnisse" : "Noch keine Subscriber — CSV importieren"}</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: "hidden", padding: 0 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                      {["Name", "E-Mail", "Hinzugefügt", ""].map(h => (
                        <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "left", fontWeight: 600, fontSize: "0.78rem", color: "var(--muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < filteredSubs.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <td style={{ padding: "0.65rem 1rem", fontWeight: 500 }}>{s.name || "—"}</td>
                        <td style={{ padding: "0.65rem 1rem", color: "var(--muted)" }}>{s.email}</td>
                        <td style={{ padding: "0.65rem 1rem", color: "var(--muted)", fontSize: "0.8rem" }}>
                          {new Date(s.addedAt).toLocaleDateString("de-AT")}
                        </td>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          <button
                            onClick={() => deleteSub(s.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem" }}
                            title="Löschen"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Newsletter tab */}
        {tab === "newsletter" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {!showForm && (
              <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}
                onClick={() => { setNlSubject(""); setNlBody(""); setEditingId(null); setShowForm(true); }}>
                + Neuen Newsletter erstellen
              </button>
            )}

            {/* Newsletter form */}
            {showForm && (
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1.25rem" }}>
                  {editingId ? "Newsletter bearbeiten" : "Neuen Newsletter erstellen"}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div>
                    <label className="label">Betreffzeile / Thema</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        className="input"
                        style={{ flex: 1 }}
                        value={nlSubject}
                        onChange={e => setNlSubject(e.target.value)}
                        placeholder="Betreff oder Thema…"
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={generateNewsletter}
                        disabled={nlLoading || !nlSubject.trim()}
                      >
                        {nlLoading ? "Generiere…" : "✨ KI-Hilfe"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Inhalt</label>
                    <textarea
                      className="textarea"
                      style={{ minHeight: 280, resize: "vertical" }}
                      value={nlBody}
                      onChange={e => setNlBody(e.target.value)}
                      placeholder="Newsletter-Text… (HTML oder Klartext)"
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "flex-end" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditingId(null); }}>
                    Abbrechen
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={saveNewsletter} disabled={!nlSubject.trim()}>
                    Speichern
                  </button>
                </div>
              </div>
            )}

            {/* Newsletter list */}
            {newsletters.length === 0 && !showForm ? (
              <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✉️</div>
                <div>Noch keine Newsletter — erstelle deinen ersten</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {newsletters.map(n => (
                  <div key={n.id} className="card" style={{ padding: "1.1rem 1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem" }}>{n.subject}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>
                          {n.body.replace(/<[^>]+>/g, "").slice(0, 120)}…
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.35rem" }}>
                          {new Date(n.createdAt).toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" })}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => editNewsletter(n)}>Bearbeiten</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => exportNlMd(n)}>Als .md</button>
                        <button
                          onClick={() => deleteNewsletter(n.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1.1rem", padding: "0.2rem 0.4rem" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
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
