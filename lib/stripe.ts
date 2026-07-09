// ─── Stripe-Client (lazy, aus Env) ───────────────────────
// Ohne STRIPE_SECRET_KEY ist Bezahlung deaktiviert (getStripe() → null).
// Der Admin kann Kundinnen dann weiterhin manuell freischalten (comped).

import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}
