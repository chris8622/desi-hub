"use client";
import { useState, useEffect } from "react";
import { getLS, setLS } from "@/lib/storage";
import { scheduleSyncUp } from "@/lib/sync";
import { uid } from "@/lib/id";
import type { HashtagSet } from "@/lib/types";

/**
 * Verbindet den Erstell-Flow mit der Hashtag-Bank (C2):
 *  - gespeicherte Sets in die aktuellen Hashtags einfügen
 *  - die aktuellen Hashtags als neues Set speichern
 * Vorher waren Hashtag-Sets eine Einbahnstraße — befüllt, aber nie im Flow nutzbar.
 */
export default function HashtagBar({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [sets, setSets] = useState<HashtagSet[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => { setSets(getLS<HashtagSet[]>("dh_hashtag_sets", [])); }, []);

  // Nichts anzeigen, wenn es weder Sets zum Einfügen noch Tags zum Sichern gibt
  if (sets.length === 0 && tags.length === 0) return null;

  const clean = (t: string) => t.replace(/^#/, "").trim();

  const insertSet = (setId: string) => {
    const set = sets.find(s => s.id === setId);
    if (!set) return;
    // dedupliziert zusammenführen (case-insensitiv)
    const seen = new Set(tags.map(t => clean(t).toLowerCase()));
    const merged = [...tags];
    for (const t of set.tags) {
      const c = clean(t);
      if (c && !seen.has(c.toLowerCase())) { merged.push(c); seen.add(c.toLowerCase()); }
    }
    onChange(merged);
  };

  const saveAsSet = () => {
    const label = name.trim();
    if (!label || tags.length === 0) return;
    const set: HashtagSet = {
      id: uid(), name: label, emoji: "#️⃣",
      tags: tags.map(clean).filter(Boolean),
      createdAt: new Date().toISOString(),
    };
    const updated = [set, ...getLS<HashtagSet[]>("dh_hashtag_sets", [])];
    setLS("dh_hashtag_sets", updated);
    setSets(updated);
    scheduleSyncUp(2000);
    setSaving(false); setName(""); setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
      {sets.length > 0 && (
        <select
          className="select"
          style={{ width: "auto", minWidth: 170, fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
          value=""
          onChange={e => { if (e.target.value) { insertSet(e.target.value); e.target.value = ""; } }}
        >
          <option value="">＋ Aus Set einfügen…</option>
          {sets.map(s => (
            <option key={s.id} value={s.id}>{s.emoji} {s.name} ({s.tags.length})</option>
          ))}
        </select>
      )}

      {!saving ? (
        <button className="btn btn-ghost btn-sm" disabled={tags.length === 0} onClick={() => setSaving(true)}>
          {savedMsg ? "✓ Als Set gespeichert" : "💾 Als Set speichern"}
        </button>
      ) : (
        <span style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <input
            className="input" autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveAsSet(); if (e.key === "Escape") { setSaving(false); setName(""); } }}
            placeholder="Set-Name…" style={{ width: 150, fontSize: "0.8rem", padding: "0.4rem 0.6rem" }}
          />
          <button className="btn btn-primary btn-sm" onClick={saveAsSet} disabled={!name.trim()}>Speichern</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSaving(false); setName(""); }}>Abbr.</button>
        </span>
      )}
    </div>
  );
}
