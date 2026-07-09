import { eq } from "drizzle-orm";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { readJson } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createToken } from "@/lib/authtokens";
import { sendEmail, baseUrl, emailShell, emailConfigured } from "@/lib/email";

// POST { tenantId, email, role } : Nutzer:in zu einem Mandanten einladen.
// Legt einen passwortlosen User an + „Passwort setzen"-Link (7 Tage).
// Ist kein Resend konfiguriert, wird der Link in der Antwort zurückgegeben,
// damit der Betreiber ihn manuell weitergeben kann.
export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await readJson<{ tenantId?: string; email?: string; role?: string }>(req);
  const tenantId = body?.tenantId;
  const email = (body?.email || "").toLowerCase().trim();
  const role = body?.role === "owner" ? "owner" : "member";
  if (!tenantId || !email || !email.includes("@")) {
    return Response.json({ error: "tenantId und gültige E-Mail nötig." }, { status: 400 });
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    return Response.json({ error: "Diese E-Mail ist bereits vergeben." }, { status: 409 });
  }

  try {
    const [u] = await db.insert(users).values({ tenantId, email, role, passwordHash: null }).returning({ id: users.id });
    const token = await createToken(u.id, "invite", 7 * 24 * 60 * 60 * 1000); // 7 Tage
    const link = `${baseUrl(req)}/reset?token=${token}&invite=1`;

    let emailed = false;
    try {
      await sendEmail({
        to: email,
        subject: "Deine Einladung zu Raumo",
        html: emailShell(
          "Willkommen bei Raumo",
          "<p>Du wurdest zu Raumo eingeladen. Setz dein Passwort und leg los — der Link ist 7 Tage gültig.</p>",
          { label: "Passwort setzen & loslegen", href: link },
        ),
      });
      emailed = emailConfigured();
    } catch { /* Link kommt in der Antwort zurück */ }

    await writeAudit(req, "invite", `tenant=${tenantId.slice(0, 8)} · ${email} (${role})`);
    return Response.json({ ok: true, emailed, link: emailed ? undefined : link });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
