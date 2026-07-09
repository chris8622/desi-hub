import { eq } from "drizzle-orm";
import { readJson } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { consumeToken } from "@/lib/authtokens";
import { hashPassword } from "@/lib/password";
import { authLimiter, checkRateLimit, getClientIp, tooManyRequests } from "@/lib/ratelimit";

// POST { token, password }: neues Passwort setzen (Reset ODER Einladung).
export async function POST(req: Request) {
  const rl = await checkRateLimit(authLimiter, getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec, "Zu viele Anfragen. Bitte kurz warten.");

  const body = await readJson<{ token?: string; password?: string }>(req);
  const token = (body?.token || "").trim();
  const password = body?.password || "";
  if (password.length < 8) {
    return Response.json({ error: "Das Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
  }

  // erst reset, dann invite (consumeToken markiert nur bei passendem purpose als verbraucht)
  let userId = await consumeToken(token, "reset");
  if (!userId) userId = await consumeToken(token, "invite");
  if (!userId) {
    return Response.json({ error: "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an." }, { status: 400 });
  }

  try {
    const hash = await hashPassword(password);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
