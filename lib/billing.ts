// ─── Abrechnung: Tenant-Billing lesen/setzen ─────────────
// Der Admin kann Plan/Status/Rabatt auch manuell setzen (comped, Rabatt) — ganz
// ohne Stripe. Stripe schreibt später über Webhooks in dieselben Felder.

import { eq } from "drizzle-orm";
import { db } from "./db";
import { tenants } from "./db/schema";
import { invalidateTenantFlags } from "./flags";
import { TRIAL_DAYS } from "./plans";

export type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "comped";

export type TenantBilling = {
  plan: string;
  subscriptionStatus: string;
  billingInterval: string | null;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  discountPercent: number;
};

export async function getBilling(tenantId: string): Promise<TenantBilling | null> {
  try {
    const rows = await db
      .select({
        plan: tenants.plan,
        subscriptionStatus: tenants.subscriptionStatus,
        billingInterval: tenants.billingInterval,
        trialEndsAt: tenants.trialEndsAt,
        currentPeriodEnd: tenants.currentPeriodEnd,
        stripeCustomerId: tenants.stripeCustomerId,
        stripeSubscriptionId: tenants.stripeSubscriptionId,
        discountPercent: tenants.discountPercent,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      plan: r.plan,
      subscriptionStatus: r.subscriptionStatus,
      billingInterval: r.billingInterval,
      trialEndsAt: r.trialEndsAt ? new Date(r.trialEndsAt).getTime() : null,
      currentPeriodEnd: r.currentPeriodEnd ? new Date(r.currentPeriodEnd).getTime() : null,
      stripeCustomerId: r.stripeCustomerId,
      stripeSubscriptionId: r.stripeSubscriptionId,
      discountPercent: r.discountPercent,
    };
  } catch {
    return null;
  }
}

type BillingPatch = Partial<{
  plan: string;
  subscriptionStatus: SubStatus;
  billingInterval: string | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  discountPercent: number;
}>;

export async function setBilling(tenantId: string, patch: BillingPatch): Promise<void> {
  await db.update(tenants).set(patch).where(eq(tenants.id, tenantId));
  invalidateTenantFlags(tenantId); // Zugriffsrechte hängen am Abo-Status
}

// Ablaufzeitpunkt der Testphase (ab jetzt).
export function trialEndDate(days = TRIAL_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
