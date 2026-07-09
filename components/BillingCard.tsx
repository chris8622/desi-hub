"use client";
import { useState, useEffect } from "react";
import { PLANS, PLAN_IDS, type PlanId } from "@/lib/plans";

type Status = {
  plan: string; subscriptionStatus: string;
  trialEndsAt: number | null; currentPeriodEnd: number | null;
  hasSubscription: boolean; stripeConfigured: boolean;
};

function daysLeft(ts: number | null): number {
  if (!ts) return 0;
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000));
}
function fmt(ts: number | null): string {
  return ts ? new Date(ts).toLocaleDateString("de-AT") : "–";
}

export default function BillingCard() {
  const [s, setS] = useState<Status | null>(null);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/billing/status").then(r => r.ok ? r.json() : null).then(setS).catch(() => {});
    const p = new URLSearchParams(window.location.search).get("billing");
    if (p === "success") setMsg("✅ Danke! Dein Abo ist aktiv.");
    if (p === "cancel") setMsg("Vorgang abgebrochen — kein Problem.");
  }, []);

  const checkout = async (plan: PlanId) => {
    setBusy(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      setMsg(d.error || "Checkout nicht möglich."); setBusy("");
    } catch { setMsg("Verbindungsfehler."); setBusy(""); }
  };

  const portal = async () => {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      setMsg(d.error || "Portal nicht verfügbar."); setBusy("");
    } catch { setMsg("Verbindungsfehler."); setBusy(""); }
  };

  const statusLabel = (() => {
    if (!s) return "";
    switch (s.subscriptionStatus) {
      case "comped": return "Kostenlos freigeschaltet 🎁";
      case "active": return `Aktiv · verlängert am ${fmt(s.currentPeriodEnd)}`;
      case "past_due": return "Zahlung ausständig — bitte aktualisieren";
      case "canceled": return "Gekündigt — reaktivierbar";
      case "trialing":
      default: return `Testphase — noch ${daysLeft(s.trialEndsAt)} Tage`;
    }
  })();

  return (
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <h3 style={{ marginBottom: "0.4rem" }}>💳 Abo &amp; Abrechnung</h3>
      {s && (
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "1rem" }}>
          Aktueller Plan: <strong style={{ color: "var(--text)" }}>{PLANS[(s.plan as PlanId)]?.name || s.plan}</strong> · {statusLabel}
        </p>
      )}
      {msg && <div className="alert alert-success" style={{ marginBottom: "1rem" }}>{msg}</div>}

      {s?.subscriptionStatus === "comped" ? (
        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Dein Zugang ist dauerhaft freigeschaltet — keine Zahlung nötig.</p>
      ) : !s?.stripeConfigured ? (
        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Die Bezahlung wird gerade eingerichtet. Melde dich bei Fragen jederzeit.</p>
      ) : (
        <>
          <div style={{ display: "inline-flex", gap: "0.25rem", marginBottom: "1rem", background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "0.2rem" }}>
            {(["month", "year"] as const).map(iv => (
              <button key={iv} onClick={() => setInterval(iv)}
                className="btn btn-sm" style={{
                  background: interval === iv ? "var(--surface)" : "transparent",
                  color: interval === iv ? "var(--text)" : "var(--muted)",
                  border: "none", boxShadow: interval === iv ? "var(--shadow)" : "none",
                }}>
                {iv === "month" ? "Monatlich" : "Jährlich · 2 Monate gratis"}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.65rem" }}>
            {PLAN_IDS.map(id => {
              const p = PLANS[id];
              const price = interval === "year" ? p.yearly : p.monthly;
              const current = s?.plan === id && s?.subscriptionStatus === "active";
              return (
                <div key={id} style={{ padding: "1rem 0.85rem", border: `1px solid ${p.highlight ? "var(--accent)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", background: "var(--surface2)" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>{p.name}</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent2)", margin: "0.25rem 0" }}>
                    {price} €<span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 400 }}>/{interval === "year" ? "Jahr" : "Mon"}</span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.65rem" }}>
                    {p.aiMonthlyLimit === 0 ? "KI unbegrenzt" : `${p.aiMonthlyLimit} KI/Mon`}
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }}
                    disabled={!!busy || current} onClick={() => checkout(id)}>
                    {current ? "Aktueller Plan" : busy === id ? "…" : "Wählen"}
                  </button>
                </div>
              );
            })}
          </div>
          {s?.hasSubscription && (
            <button className="btn btn-secondary btn-sm" style={{ marginTop: "1rem" }} disabled={!!busy} onClick={portal}>
              Abo verwalten / kündigen
            </button>
          )}
        </>
      )}
    </div>
  );
}
