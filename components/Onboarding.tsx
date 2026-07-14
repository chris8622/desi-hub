"use client";
import { useState } from "react";
import { getLS, setLS } from "@/lib/storage";
import { syncUp } from "@/lib/sync";

// Geführter Erststart. Ziel: In wenigen Minuten kennt Raumo die Marke der Kundin
// (Name, Thema, Zielgruppe, Stimme) — das ist die Grundlage für JEDE KI-Ausgabe —
// und sie landet direkt bei ihrem ersten Content statt in einer leeren App.

const VOICES = [
  { val: "warm-inspirierend",  label: "🌿 Warm & Inspirierend", desc: "Herzlich, motivierend, persönlich" },
  { val: "sachlich-kompetent", label: "📚 Sachlich & Kompetent", desc: "Faktenbasiert, professionell, klar" },
  { val: "direkt-motivierend", label: "🔥 Direkt & Motivierend", desc: "Knackig, antreibend, energetisch" },
  { val: "sanft-einfühlsam",   label: "🤍 Sanft & Einfühlsam",   desc: "Verständnisvoll, ruhig, nährend" },
];

const STEPS = ["Willkommen", "Dein Thema", "Deine Stimme", "Los geht's"];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [topicsRaw, setTopicsRaw] = useState("");
  const [voice, setVoice] = useState("warm-inspirierend");
  const [keywords, setKeywords] = useState("");
  const [avoid, setAvoid] = useState("");

  const topics = topicsRaw.split(",").map(t => t.trim()).filter(Boolean);

  // Profil in dieselbe Struktur schreiben, die auch die Einstellungen nutzen.
  const finish = async (skipped = false) => {
    setSaving(true);
    try {
      const current = getLS<Record<string, unknown>>("dh_settings", {});
      setLS("dh_settings", {
        ...current,
        ...(skipped ? {} : {
          name: name.trim(),
          niche: niche.trim(),
          audience: audience.trim(),
          topics,
          voice,
          brand_keywords: keywords.trim(),
          brand_avoid: avoid.trim(),
        }),
        onboarded: true,
      });
      await syncUp().catch(() => {}); // Server-Sync ist Best-Effort — lokal steht es bereits
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? niche.trim().length > 0 :
    true;

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto" }}>
      {/* Fortschritt */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.5rem" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{
              height: 4, borderRadius: 99,
              background: i <= step ? "var(--accent)" : "var(--border)",
              transition: "background 0.25s",
            }} />
            <div style={{
              fontSize: "0.68rem", marginTop: "0.35rem",
              color: i === step ? "var(--accent2)" : "var(--muted)",
              fontWeight: i === step ? 700 : 500,
            }}>{s}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "2rem" }}>
        {/* Schritt 1 — Willkommen */}
        {step === 0 && (
          <>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.7rem", marginBottom: "0.5rem" }}>
              Willkommen bei Raumo 🌿
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Zwei Minuten, drei Fragen — danach kennt Raumo deine Marke und schreibt in
              <em> deinem</em> Ton. Du kannst später alles in den Einstellungen ändern.
            </p>
            <label className="label">Wie heißt du?</label>
            <input
              className="input" autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="Dein Vorname"
              onKeyDown={e => { if (e.key === "Enter" && canNext) setStep(1); }}
            />
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.4rem" }}>
              Damit begrüßt dich Raumo — sonst nichts.
            </p>
          </>
        )}

        {/* Schritt 2 — Thema */}
        {step === 1 && (
          <>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.7rem", marginBottom: "0.5rem" }}>
              Worüber sprichst du?
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Das gibt der KI den Rahmen — damit Ideen und Texte zu deinem Thema passen
              und nicht generisch werden.
            </p>

            <label className="label">Deine Nische / dein Themenbereich</label>
            <input
              className="input" autoFocus value={niche} onChange={e => setNiche(e.target.value)}
              placeholder="z.B. Yoga & Achtsamkeit, Ernährungsberatung, Business-Coaching"
            />

            <label className="label" style={{ marginTop: "1.1rem" }}>Für wen schreibst du?</label>
            <input
              className="input" value={audience} onChange={e => setAudience(e.target.value)}
              placeholder="z.B. Frauen 25–40, die zur Ruhe kommen wollen"
            />

            <label className="label" style={{ marginTop: "1.1rem" }}>Deine Kernthemen (optional)</label>
            <input
              className="input" value={topicsRaw} onChange={e => setTopicsRaw(e.target.value)}
              placeholder="Mit Komma trennen: Stressabbau, Schlaf, Routinen"
            />
            {topics.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.6rem" }}>
                {topics.map(t => (
                  <span key={t} className="badge badge-terra" style={{ fontSize: "0.72rem" }}>{t}</span>
                ))}
              </div>
            )}
          </>
        )}

        {/* Schritt 3 — Stimme */}
        {step === 2 && (
          <>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.7rem", marginBottom: "0.5rem" }}>
              Wie klingst du?
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Das ist der wichtigste Schritt: Diese Angaben fließen in <strong>jede</strong> Generierung ein.
              Deshalb klingt Raumo nach dir — und nicht nach KI von der Stange.
            </p>

            <label className="label">Dein Ton</label>
            <div className="grid-2" style={{ gap: "0.65rem" }}>
              {VOICES.map(opt => (
                <button key={opt.val} onClick={() => setVoice(opt.val)}
                  style={{
                    padding: "0.85rem 1rem", borderRadius: "var(--radius-sm)", cursor: "pointer",
                    border: voice === opt.val ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: voice === opt.val ? "var(--accent-light)" : "var(--surface2)",
                    textAlign: "left", transition: "all 0.15s",
                  }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: voice === opt.val ? "var(--accent2)" : "var(--text)" }}>{opt.label}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>{opt.desc}</div>
                </button>
              ))}
            </div>

            <label className="label" style={{ marginTop: "1.25rem" }}>✨ Wörter, die du liebst (optional)</label>
            <input
              className="input" value={keywords} onChange={e => setKeywords(e.target.value)}
              placeholder="z.B. verwurzelt, mit Leichtigkeit, authentisch"
            />

            <label className="label" style={{ marginTop: "1.1rem" }}>🚫 Wörter, die du nie willst (optional)</label>
            <input
              className="input" value={avoid} onChange={e => setAvoid(e.target.value)}
              placeholder="z.B. du musst, perfekt, Hustle"
            />
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.4rem" }}>
              Diese Wörter vermeidet die KI konsequent.
            </p>
          </>
        )}

        {/* Schritt 4 — Fertig */}
        {step === 3 && (
          <>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.7rem", marginBottom: "0.5rem" }}>
              Alles bereit, {name || "los geht's"} 🎉
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
              Raumo kennt jetzt dein Thema und deinen Ton. Die KI ist bereits startklar —
              du musst nichts weiter einrichten.
            </p>

            <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "1rem 1.15rem", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.9 }}>
                <div><strong style={{ color: "var(--text)" }}>Thema:</strong> {niche || "—"}</div>
                {audience && <div><strong style={{ color: "var(--text)" }}>Zielgruppe:</strong> {audience}</div>}
                <div><strong style={{ color: "var(--text)" }}>Ton:</strong> {VOICES.find(v => v.val === voice)?.label}</div>
              </div>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.6, marginBottom: "0.5rem" }}>
              <strong>Dein nächster Schritt:</strong> Erstelle deinen ersten Content. Wähle ein Thema,
              und Raumo schreibt dir Karussell, Caption und Hashtags — in deinem Ton.
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.6 }}>
              Übrigens: Du kannst jederzeit deine eigene KI-Verbindung hinterlegen
              (Einstellungen → KI-Verbindung) — dann läuft alles über dein eigenes Konto.
            </p>
          </>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1.75rem" }}>
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)} disabled={saving}>
              Zurück
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Weiter
            </button>
          ) : (
            <button
              className="btn btn-primary" disabled={saving}
              onClick={async () => { await finish(false); window.location.href = "/content"; }}
            >
              {saving ? "Speichere…" : "Ersten Content erstellen →"}
            </button>
          )}
        </div>

        {/* Später einrichten */}
        {step < 3 && (
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              onClick={async () => { await finish(true); onDone(); }} disabled={saving}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--muted)", textDecoration: "underline" }}>
              Später einrichten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
