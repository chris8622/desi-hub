import { requireAdmin, writeAudit } from "@/lib/admin";
import { readJson } from "@/lib/server-auth";
import { getBilling, setBilling, trialEndDate, type SubStatus } from "@/lib/billing";
import { isPlanId } from "@/lib/plans";

const STATUSES: SubStatus[] = ["trialing", "active", "past_due", "canceled", "comped"];

// GET ?tenantId=… : Abrechnungsdaten eines Tenants.
export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const tenantId = new URL(req.url).searchParams.get("tenantId");
  if (!tenantId) return Response.json({ error: "tenantId fehlt." }, { status: 400 });
  const billing = await getBilling(tenantId);
  return Response.json({ billing });
}

// POST { tenantId, plan?, subscriptionStatus?, discountPercent?, billingInterval?, extendTrialDays? }
// Betreiber setzt Plan/Status/Rabatt manuell (comped, Rabatt, Trial verlängern — ohne Stripe).
export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await readJson<{
    tenantId?: string; plan?: string; subscriptionStatus?: string;
    discountPercent?: number; billingInterval?: string; extendTrialDays?: number;
  }>(req);
  if (!body?.tenantId) return Response.json({ error: "tenantId fehlt." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.plan !== undefined) {
    if (!isPlanId(body.plan)) return Response.json({ error: "Unbekannter Plan." }, { status: 400 });
    patch.plan = body.plan;
  }
  if (body.subscriptionStatus !== undefined) {
    if (!STATUSES.includes(body.subscriptionStatus as SubStatus)) return Response.json({ error: "Unbekannter Status." }, { status: 400 });
    patch.subscriptionStatus = body.subscriptionStatus;
  }
  if (body.discountPercent !== undefined) {
    const d = Math.max(0, Math.min(100, Math.floor(Number(body.discountPercent) || 0)));
    patch.discountPercent = d;
  }
  if (body.billingInterval !== undefined) {
    patch.billingInterval = body.billingInterval === "year" ? "year" : "month";
  }
  if (body.extendTrialDays && body.extendTrialDays > 0) {
    patch.trialEndsAt = trialEndDate(Math.min(365, Math.floor(body.extendTrialDays)));
    patch.subscriptionStatus = patch.subscriptionStatus || "trialing";
  }

  if (Object.keys(patch).length === 0) return Response.json({ error: "Nichts zu ändern." }, { status: 400 });

  try {
    await setBilling(body.tenantId, patch);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }

  await writeAudit(req, "billing_update", `tenant=${body.tenantId.slice(0, 8)} · ${Object.keys(patch).join(",")}`);
  return Response.json({ ok: true, billing: await getBilling(body.tenantId) });
}
