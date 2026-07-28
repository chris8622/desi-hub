import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { readJson } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { tenants, users, entitlements, workspaces } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { isPlanId, DEFAULT_PLAN, TRIAL_DAYS } from "@/lib/plans";
import { trialEndDate } from "@/lib/billing";
import { sendEmail, emailShell, baseUrl, notifyOperator } from "@/lib/email";
import { authLimiter, checkRateLimit, getClientIp, tooManyRequests } from "@/lib/ratelimit";

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "raumo";
}

// POST { email, name, password, plan, agb } : Selbst-Registrierung mit Testphase.
export async function POST(req: Request) {
  const rl = await checkRateLimit(authLimiter, getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec, "Zu viele Versuche. Bitte kurz warten.");

  const body = await readJson<{ email?: string; name?: string; password?: string; plan?: string; agb?: boolean }>(req);
  const email = (body?.email || "").toLowerCase().trim();
  const name = (body?.name || "").trim();
  const password = body?.password || "";
  const plan = isPlanId(body?.plan) ? body!.plan! : DEFAULT_PLAN;

  if (!email.includes("@") || email.length > 200) return Response.json({ error: "Bitte eine gültige E-Mail angeben." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Das Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
  if (!body?.agb) return Response.json({ error: "Bitte AGB und Datenschutz akzeptieren." }, { status: 400 });

  // E-Mail schon vergeben?
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return Response.json({ error: "Für diese E-Mail existiert bereits ein Konto." }, { status: 409 });

  try {
    const slug = `${slugify(name || email.split("@")[0])}-${randomBytes(3).toString("hex")}`;
    const [tenant] = await db.insert(tenants).values({
      slug,
      name: name || email.split("@")[0],
      plan,
      subscriptionStatus: "trialing",
      trialEndsAt: trialEndDate(),
    }).returning({ id: tenants.id });

    await db.insert(entitlements).values({ tenantId: tenant.id });
    await db.insert(workspaces).values({ tenantId: tenant.id, data: {} });
    await db.insert(users).values({
      tenantId: tenant.id,
      email,
      name: name || null,
      role: "owner",
      passwordHash: await hashPassword(password),
      agbAcceptedAt: new Date(),
    });

    // Willkommens-/Bestätigungs-Mail (Dev: Server-Log)
    try {
      await sendEmail({
        to: email,
        subject: "Willkommen bei Raumo 🌿",
        html: emailShell(
          "Willkommen bei Raumo",
          "<p>Dein Konto ist bereit — deine 14-tägige Testphase läuft. Melde dich an und leg los.</p>",
          { label: "Zu Raumo", href: `${baseUrl(req)}/login` },
        ),
      });
    } catch { /* Konto steht trotzdem */ }

    // Interne Info an den Betreiber — jede neue Registrierung sofort sichtbar.
    await notifyOperator("🌱 Neue Registrierung bei Raumo", [
      `<strong>${name || "(kein Name)"}</strong> · ${email}`,
      `Plan: ${plan} · Testphase ${TRIAL_DAYS} Tage`,
    ]);

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
