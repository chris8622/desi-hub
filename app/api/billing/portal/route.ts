import { getSessionContext } from "@/lib/server-auth";
import { getStripe } from "@/lib/stripe";
import { getBilling } from "@/lib/billing";
import { baseUrl } from "@/lib/email";

// POST : öffnet das Stripe-Kundenportal (Zahlungsdaten, Kündigung, Rechnungen).
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  const stripe = getStripe();
  if (!stripe) return Response.json({ error: "Bezahlung ist derzeit nicht konfiguriert." }, { status: 503 });

  const billing = await getBilling(ctx.tenantId);
  if (!billing?.stripeCustomerId) {
    return Response.json({ error: "Noch kein Abo vorhanden." }, { status: 400 });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${baseUrl(req)}/settings`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
