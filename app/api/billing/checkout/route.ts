import { eq } from "drizzle-orm";
import { getSessionContext, readJson } from "@/lib/server-auth";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { setBilling } from "@/lib/billing";
import { isPlanId, stripePriceId } from "@/lib/plans";
import { baseUrl } from "@/lib/email";

// POST { plan, interval } : startet Stripe-Checkout für ein Abo. Gibt die
// Checkout-URL zurück. Gutscheincodes sind im Checkout aktiviert.
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  const stripe = getStripe();
  if (!stripe) return Response.json({ error: "Bezahlung ist derzeit nicht konfiguriert." }, { status: 503 });

  const body = await readJson<{ plan?: string; interval?: string }>(req);
  const plan = body?.plan;
  const interval = body?.interval === "year" ? "year" : "month";
  if (!isPlanId(plan)) return Response.json({ error: "Unbekannter Plan." }, { status: 400 });
  const priceId = stripePriceId(plan, interval);
  if (!priceId) return Response.json({ error: "Für diesen Plan ist noch kein Preis hinterlegt." }, { status: 503 });

  try {
    // Stripe-Kunde finden/anlegen (pro Tenant), E-Mail vom Owner
    const rows = await db.select({ email: users.email, stripeCustomerId: tenants.stripeCustomerId })
      .from(tenants).leftJoin(users, eq(users.tenantId, tenants.id))
      .where(eq(tenants.id, ctx.tenantId)).limit(1);
    let customerId = rows[0]?.stripeCustomerId || undefined;
    const email = rows.find(r => r.email)?.email || undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { tenantId: ctx.tenantId } });
      customerId = customer.id;
      await setBilling(ctx.tenantId, { stripeCustomerId: customerId });
    }

    const base = baseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true, // Gutscheincodes/Rabatte
      subscription_data: { metadata: { tenantId: ctx.tenantId, plan } },
      metadata: { tenantId: ctx.tenantId, plan, interval },
      success_url: `${base}/settings?billing=success`,
      cancel_url: `${base}/settings?billing=cancel`,
    });

    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
