import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { setBilling, type SubStatus } from "@/lib/billing";
import { isPlanId } from "@/lib/plans";
import { notifyOperator } from "@/lib/email";

export const maxDuration = 30;

function mapStatus(s: Stripe.Subscription.Status): SubStatus {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid" || s === "incomplete") return "past_due";
  return "canceled"; // canceled | incomplete_expired | paused
}

async function applySubscription(tenantId: string, sub: Stripe.Subscription, planMeta?: string) {
  const price = sub.items.data[0]?.price;
  await setBilling(tenantId, {
    subscriptionStatus: mapStatus(sub.status),
    plan: isPlanId(planMeta) ? planMeta : undefined,
    billingInterval: price?.recurring?.interval === "year" ? "year" : "month",
    currentPeriodEnd: sub.items.data[0]?.current_period_end
      ? new Date(sub.items.data[0].current_period_end * 1000)
      : null,
    stripeSubscriptionId: sub.id,
  });
}

// Stripe-Webhook: aktualisiert den Abo-Status. Signatur wird geprüft.
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return Response.json({ error: "Stripe nicht konfiguriert." }, { status: 503 });

  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return Response.json({ error: "Ungültige Signatur." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const tenantId = s.metadata?.tenantId;
      if (tenantId && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(String(s.subscription));
        await applySubscription(tenantId, sub, s.metadata?.plan);
        // Der wichtigste Moment: zahlende Kundin. Sofort an den Betreiber melden.
        await notifyOperator("💚 Neues Abo bei Raumo", [
          `Plan: <strong>${s.metadata?.plan || "?"}</strong> · ${s.metadata?.interval === "year" ? "jährlich" : "monatlich"}`,
          `Kundin: ${s.customer_details?.email || "(E-Mail unbekannt)"}`,
          s.amount_total != null ? `Betrag: ${(s.amount_total / 100).toFixed(2)} ${(s.currency || "eur").toUpperCase()}` : "",
        ].filter(Boolean));
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (tenantId) {
        if (event.type === "customer.subscription.deleted") {
          await setBilling(tenantId, { subscriptionStatus: "canceled" });
        } else {
          await applySubscription(tenantId, sub, sub.metadata?.plan);
        }
      }
    } else if (event.type === "invoice.payment_failed") {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string };
      if (inv.subscription) {
        const sub = await stripe.subscriptions.retrieve(String(inv.subscription));
        const tenantId = sub.metadata?.tenantId;
        if (tenantId) await setBilling(tenantId, { subscriptionStatus: "past_due" });
      }
    }
  } catch (e) {
    // 500 → Stripe wiederholt den Webhook
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }

  return Response.json({ received: true });
}
