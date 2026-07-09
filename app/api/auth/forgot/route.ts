import { eq } from "drizzle-orm";
import { readJson } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createToken } from "@/lib/authtokens";
import { sendEmail, baseUrl, emailShell } from "@/lib/email";
import { authLimiter, checkRateLimit, getClientIp, tooManyRequests } from "@/lib/ratelimit";

// POST { email }: Reset-Link anfordern. Antwortet IMMER 200 (kein Leak, ob die
// E-Mail existiert). Existiert ein Konto, geht ein 1-Stunden-Link raus.
export async function POST(req: Request) {
  const rl = await checkRateLimit(authLimiter, getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec, "Zu viele Anfragen. Bitte kurz warten.");

  const body = await readJson<{ email?: string }>(req);
  const email = (body?.email || "").toLowerCase().trim();

  if (email) {
    try {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      const user = rows[0];
      if (user) {
        const token = await createToken(user.id, "reset", 60 * 60 * 1000); // 1 h
        const link = `${baseUrl(req)}/reset?token=${token}`;
        await sendEmail({
          to: email,
          subject: "Passwort zurücksetzen — Contentraum",
          html: emailShell(
            "Passwort zurücksetzen",
            "<p>Du hast angefragt, dein Passwort zurückzusetzen. Der Link ist 1 Stunde gültig. Wenn du das nicht warst, ignorier diese Mail einfach.</p>",
            { label: "Neues Passwort setzen", href: link },
          ),
        });
      }
    } catch { /* trotzdem 200 */ }
  }

  return Response.json({ ok: true });
}
