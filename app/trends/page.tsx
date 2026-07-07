"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginGate from "@/components/LoginGate";
import { scheduleSyncUp } from "@/lib/sync";
import { trackTokens } from "@/lib/tokens";
import { getLS, setLS } from "@/lib/storage";

type Trend = {
  name: string;
  description: string;
  origin: "USA" | "China" | "Europa" | "Global";
  europe_status: "schon_da" | "kommt_bald" | "frueh_dran";
  opportunity: string;
  heat: number;
};
type Result = {
  trends: Trend[];
  early_signals: string[];
  summary: string;
  sources: { title: string; url: string }[];
};

const ORIGIN_FLAG: Record<string, string> = { USA: "🇺🇸", China: "🇨🇳", Europa: "🇪🇺", Global: "🌍" };
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  frueh_dran:  { label: "Früh dran — Goldnugget!", emoji: "🚀", color: "var(--accent2)", bg: "var(--accent-light)" },
  kommt_bald:  { label: "Kommt bald nach Europa",  emoji: "⏳", color: "var(--gold)",    bg: "var(--gold-light)"   },
  schon_da:    { label: "Schon in Europa da",      emoji: "✅", color: "var(--sage)",    bg: "var(--sage-light)"   },
};

export default function TrendsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [niche, setNiche] = useState("");
  const [lastScan, setLastScan] = useState<string>("");

  // Letzten Scan beim Öffnen laden
  useEffect(() => {
    const saved = getLS<{ result: Result; date: string; niche: string } | null>("dh_trends_latest", null);
    if (saved && saved.result) {
      setResult(saved.result);
      setLastScan(saved.date);
      if (saved.niche) setNiche(saved.niche);
    }
  }, []);

  const runTrends = async () => {
    setError(""); setResult(null);
    const settings = getLS<{ niche?: string }>("dh_settings", {});
    // Keine hardcodierte Fallback-Nische — sonst kämen Trends für die falsche Zielgruppe
    const useNiche = niche.trim() || settings.niche?.trim() || "";
    if (!useNiche) {
      setError("Bitte gib deine Nische an — oben im Feld oder in den Einstellungen unter Profil.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-token": localStorage.getItem("desi_auth_token") || "" },
        body: JSON.stringify({ niche: useNiche }),
      });
      // Fehlerantworten (400/401/429/503) sind JSON, kein Stream — sauber melden
      if (!res.ok || !res.body) {
        let msg = `Fehler ${res.status} — bitte versuche es erneut.`;
        try { const d = await res.json() as { error?: string }; if (d.error) msg = d.error; } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "status") setStatus(evt.data);
            if (evt.type === "error") { setError(evt.data); setLoading(false); }
            if (evt.type === "result") {
              trackTokens(evt.data.tokens || 0);
              const r: Result = {
                trends: Array.isArray(evt.data.trends) ? evt.data.trends : [],
                early_signals: Array.isArray(evt.data.early_signals) ? evt.data.early_signals : [],
                summary: evt.data.summary || "",
                sources: Array.isArray(evt.data.sources) ? evt.data.sources : [],
              };
              setResult(r);
              const dateStr = new Date().toLocaleDateString("de-AT", { day: "2-digit", month: "long", year: "numeric" });
              setLastScan(dateStr);
              // Speichern für Dashboard + Wiederanzeige
              setLS("dh_trends_latest", { result: r, date: dateStr, niche: useNiche });
              scheduleSyncUp(2000);
              setLoading(false); setStatus("");
            }
          } catch {}
        }
      }
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); setStatus(""); }
  };

  // Trend → Idee in den Pool
  const toIdea = (t: Trend) => {
    const pool = getLS<{ id: string; title: string; notes: string; tags: string[]; status: string; createdAt: string; updatedAt: string }[]>("dh_ideenpool", []);
    const idea = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: t.name,
      notes: `${t.description}\n\nContent-Idee: ${t.opportunity}\nHerkunft: ${t.origin} · Status: ${STATUS_CONFIG[t.europe_status]?.label || t.europe_status}`,
      tags: ["Trend"],
      status: "neu",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLS("dh_ideenpool", [idea, ...pool]);
    scheduleSyncUp(3000);
    alert(`"${t.name}" wurde in den Ideen-Pool übernommen!`);
  };

  // Trend → direkt recherchieren
  const toResearch = (t: Trend) => {
    setLS("dh_research_prefill", t.name);
    router.push("/research");
  };

  return (
    <LoginGate>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1>Trend-Radar 📈</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Entdecke was in den USA &amp; China gerade trendet — bevor es nach Europa kommt
          </p>
        </div>

        {/* Erklärung */}
        <div style={{ background: "var(--accent-light)", border: "1px solid rgba(196,112,74,0.25)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1.1rem", marginBottom: "1.5rem", fontSize: "0.82rem", color: "var(--accent2)", lineHeight: 1.5 }}>
          💡 Trends starten oft in den USA (6–12 Monate Vorsprung) oder China (12–18 Monate via Xiaohongshu &amp; Douyin) und kommen verzögert nach Europa. Wer früh aufspringt, ist der Konkurrenz voraus.
        </div>

        {/* Suche */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input className="input" value={niche} onChange={e => setNiche(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && runTrends()}
              placeholder="Nische (leer = aus Einstellungen, z.B. Hautpflege, Mindset)"
              style={{ flex: 1, minWidth: 200 }} disabled={loading} />
            <button className="btn btn-primary" onClick={runTrends} disabled={loading}>
              {loading ? "Scanne…" : result ? "🔄 Neu scannen" : "📡 Trends scannen"}
            </button>
          </div>
          {lastScan && !loading && (
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.65rem" }}>
              📅 Zuletzt gescannt: {lastScan}
            </div>
          )}
        </div>

        {/* Status */}
        {loading && status && (
          <div className="status-row" style={{ marginBottom: "1.5rem" }}>
            <span className="pulse-dot" /> {status}
          </div>
        )}

        {/* Fehler */}
        {error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>⚠️ {error}</div>}

        {/* Empty */}
        {!loading && !result && !error && (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <p>Klick auf <strong>Trends scannen</strong> — der Radar durchsucht USA, China &amp; Europa nach aufkommenden Themen in deiner Nische.</p>
          </div>
        )}

        {/* Ergebnis */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Zusammenfassung */}
            {result.summary && (
              <div className="card" style={{ borderLeft: "4px solid var(--accent)" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" }}>🎯 Einschätzung</div>
                <p style={{ fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text)" }}>{result.summary}</p>
              </div>
            )}

            {/* Early Signals — die Goldnuggets */}
            {result.early_signals.length > 0 && (
              <div className="card" style={{ background: "var(--accent-light)", border: "1px solid var(--accent)" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.75rem", color: "var(--accent2)" }}>
                  🚀 Frühe Signale — noch nicht in Europa
                </div>
                <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {result.early_signals.map((sig, i) => (
                    <li key={i} style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5 }}>{sig}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trend-Karten */}
            {result.trends.length > 0 && (
              <div>
                <div className="section-label">Trends ({result.trends.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {result.trends.map((t, i) => {
                    const st = STATUS_CONFIG[t.europe_status] || STATUS_CONFIG.kommt_bald;
                    return (
                      <div key={i} className="card" style={{ borderLeft: `4px solid ${st.color}`, padding: "1.1rem 1.25rem" }}>
                        <div className="flex-between" style={{ alignItems: "flex-start", marginBottom: "0.5rem" }}>
                          <div style={{ fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span>{ORIGIN_FLAG[t.origin] || "🌍"}</span> {t.name}
                          </div>
                          <span style={{ fontSize: "0.85rem" }}>{"🔥".repeat(Math.max(1, Math.min(5, t.heat || 1)))}</span>
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5, marginBottom: "0.6rem" }}>{t.description}</p>

                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: st.bg, color: st.color, borderRadius: 999, padding: "0.2rem 0.7rem", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.6rem" }}>
                          {st.emoji} {st.label}
                        </div>

                        <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "0.65rem 0.85rem", fontSize: "0.82rem", color: "var(--text)", marginBottom: "0.75rem" }}>
                          💡 <strong>Content-Idee:</strong> {t.opportunity}
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button onClick={() => toIdea(t)} className="btn btn-sm btn-secondary">🌱 In Ideen-Pool</button>
                          <button onClick={() => toResearch(t)} className="btn btn-sm btn-secondary">🔍 Recherchieren</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quellen */}
            {result.sources.length > 0 && (
              <div>
                <div className="section-label">📚 Quellen ({result.sources.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {result.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", color: "var(--accent)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.25rem 0.7rem", textDecoration: "none", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(() => { try { return new URL(s.url).hostname.replace("www.", ""); } catch { return s.url; } })()}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </LoginGate>
  );
}
