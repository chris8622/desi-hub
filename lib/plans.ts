// ─── Pläne & Abrechnung (Raumo) ──────────────────────────
// Ein Plan bestimmt die Entitlements (KI-Kontingent; alle Module inklusive).
// Preise IMMER inkl. (Kleinunternehmer, keine USt). Jährlich = 10 Monatspreise
// (2 Monate gratis). Die Stripe-Price-IDs kommen aus Env-Vars (erst mit Stripe-Konto).

export type PlanId = "starter" | "pro" | "studio";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;          // € / Monat (inkl.)
  yearly: number;           // € / Jahr (inkl.)
  aiMonthlyLimit: number;   // KI-Aufrufe/Monat; 0 = unbegrenzt
  highlight?: boolean;
  stripePriceMonthlyEnv: string;
  stripePriceYearlyEnv: string;
};

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter", name: "Starter", tagline: "Für den Einstieg — regelmäßig Content erstellen",
    monthly: 29, yearly: 290, aiMonthlyLimit: 150,
    stripePriceMonthlyEnv: "STRIPE_PRICE_STARTER_MONTH",
    stripePriceYearlyEnv: "STRIPE_PRICE_STARTER_YEAR",
  },
  pro: {
    id: "pro", name: "Pro", tagline: "Für Creator, die ernst machen", highlight: true,
    monthly: 59, yearly: 590, aiMonthlyLimit: 500,
    stripePriceMonthlyEnv: "STRIPE_PRICE_PRO_MONTH",
    stripePriceYearlyEnv: "STRIPE_PRICE_PRO_YEAR",
  },
  studio: {
    id: "studio", name: "Studio", tagline: "Volle Power, ohne Limit",
    monthly: 99, yearly: 990, aiMonthlyLimit: 0,
    stripePriceMonthlyEnv: "STRIPE_PRICE_STUDIO_MONTH",
    stripePriceYearlyEnv: "STRIPE_PRICE_STUDIO_YEAR",
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const DEFAULT_PLAN: PlanId = "pro";
export const TRIAL_DAYS = 14;

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

export function getPlan(id: string): Plan {
  return PLANS[(isPlanId(id) ? id : DEFAULT_PLAN)];
}

// Das KI-Kontingent eines Plans (Grundlage der Entitlements).
export function planAiLimit(id: string): number {
  return getPlan(id).aiMonthlyLimit;
}

// Stripe-Price-ID für Plan + Intervall (aus Env). Null, wenn nicht konfiguriert.
export function stripePriceId(id: PlanId, interval: "month" | "year"): string | null {
  const p = PLANS[id];
  const envName = interval === "year" ? p.stripePriceYearlyEnv : p.stripePriceMonthlyEnv;
  return process.env[envName] || null;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
