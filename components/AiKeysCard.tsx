"use client";
import { useState, useEffect } from "react";

// Karte „KI-Verbindung" (BYOK) — jede Kundin kann eigene Anbieter-Keys hinterlegen.
// Der Key wird serverseitig verschlüsselt gespeichert und NIE zurückgeladen;
// die Karte zeigt nur den Status. Ohne eigenen Key läuft die KI über den
// Operator-Key (Standard).

type Provider = "groq" | "openai" | "gemini" | "anthropic" | "perplexity";

const PROVIDERS: { id: Provider; label: string; where: string; url: string }[] = [
  { id: "groq",       label: "Groq (Llama)",     where: "console.groq.com",              url: "https://console.groq.com/keys" },
  { id: "openai",     label: "OpenAI (GPT)",     where: "platform.openai.com",           url: "https://platform.openai.com/api-keys" },
  { id: "gemini",     label: "Google Gemini",    where: "aistudio.google.com",           url: "https://aistudio.google.com/apikey" },
  { id: "anthropic",  label: "Anthropic (Claude)", where: "console.anthropic.com",       url: "https://console.anthropic.com/settings/keys" },
  { id: "perplexity", label: "Perplexity Sonar", where: "perplexity.ai",                 url: "https://www.perplexity.ai/settings/api" },
];

export default function AiKeysCard() {
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  const [configured, setConfigured] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/settings/ai-keys");
      if (!res.ok) return;
      const d = await res.json() as { status: Record<string, boolean>; configured: boolean };
      setStatus(d.status);
      setConfigured(d.configured);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const save = async (p: Provider) => {
    const key = (drafts[p] || "").trim();
    if (!key) return;
    setBusy(p);
    try {
      const res = await fetch("/api/settings/ai-keys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p, key }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string; verified?: boolean; note?: string };
      if (!res.ok) throw new Error(d.error || "Fehler beim Speichern.");
      setDrafts(prev => ({ ...prev, [p]: "" }));
      await load();
      flash("ok", d.verified ? "Schlüssel geprüft & gespeichert ✓" : (d.note || "Schlüssel gespeichert."));
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const remove = async (p: Provider) => {
    setBusy(p);
    try {
      const res = await fetch("/api/settings/ai-keys", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Fehler."); }
      await load();
      flash("ok", "Schlüssel entfernt — läuft wieder über den Standard.");
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <h3 style={{ marginBottom: "0.4rem" }}>🔑 KI-Verbindung</h3>
      <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
        Hinterlege deinen eigenen Anbieter-Schlüssel, um mit deinem Konto zu arbeiten.
        Ohne eigenen Schlüssel läuft die KI automatisch über den Standard-Zugang.
        Dein Schlüssel wird verschlüsselt gespeichert und nie wieder angezeigt.
      </p>

      {!configured && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          Eigene Schlüssel sind für diese Instanz noch nicht freigeschaltet.
        </div>
      )}

      {msg && (
        <div className={`alert ${msg.kind === "ok" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>{msg.text}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {PROVIDERS.map(p => {
          const set = !!status?.[p.id];
          return (
            <div key={p.id} style={{ padding: "0.85rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.4rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.label}</span>
                <span className={`badge ${set ? "badge-sage" : "badge-muted"}`}>
                  {set ? "eigener Schlüssel ✓" : "Standard-Zugang"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  className="input" type="password" placeholder={set ? "Neuen Schlüssel eintragen (ersetzt)…" : "API-Schlüssel einfügen…"}
                  value={drafts[p.id] || ""} disabled={!configured || busy === p.id}
                  onChange={e => setDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                  style={{ flex: 1, minWidth: 180 }}
                />
                <button className="btn btn-primary btn-sm" disabled={!configured || busy === p.id || !(drafts[p.id] || "").trim()} onClick={() => save(p.id)}>
                  {busy === p.id ? "…" : "Speichern"}
                </button>
                {set && (
                  <button className="btn btn-secondary btn-sm" disabled={busy === p.id} onClick={() => remove(p.id)}
                    style={{ color: "var(--warm-red)", borderColor: "var(--warm-red)" }}>
                    Entfernen
                  </button>
                )}
              </div>
              <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.4rem" }}>
                Schlüssel bekommst du bei{" "}
                <a href={p.url} target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>{p.where}</a>.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
