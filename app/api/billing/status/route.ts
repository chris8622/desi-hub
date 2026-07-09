import { getSessionContext } from "@/lib/server-auth";
import { getBilling } from "@/lib/billing";
import { stripeConfigured } from "@/lib/plans";

// Kunden-Sicht auf das eigene Abo (keine Stripe-IDs).
export async function GET() {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  const b = await getBilling(ctx.tenantId);
  return Response.json({
    plan: b?.plan || "starter",
    subscriptionStatus: b?.subscriptionStatus || "trialing",
    trialEndsAt: b?.trialEndsAt || null,
    currentPeriodEnd: b?.currentPeriodEnd || null,
    hasSubscription: !!b?.stripeCustomerId,
    stripeConfigured: stripeConfigured(),
  });
}
