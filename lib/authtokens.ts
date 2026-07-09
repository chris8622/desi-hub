// ─── Einmal-Tokens (Passwort-Reset & Einladung) ──────────
// Rohes Token geht in den Link/die Mail; in der DB liegt nur der sha256-Hash.
// consumeToken markiert einmalig als verbraucht (used_at).

import { createHash, randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { authTokens } from "./db/schema";

export type TokenPurpose = "reset" | "invite";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Erzeugt ein Token, speichert den Hash, gibt das ROHE Token zurück (für den Link).
export async function createToken(userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.insert(authTokens).values({ userId, tokenHash: hashToken(raw), purpose, expiresAt });
  return raw;
}

// Prüft & verbraucht ein Token. Gibt die userId zurück oder null (ungültig/abgelaufen/verbraucht).
export async function consumeToken(raw: string, purpose: TokenPurpose): Promise<string | null> {
  if (!raw || typeof raw !== "string") return null;
  const hash = hashToken(raw);
  try {
    const rows = await db
      .select({ id: authTokens.id, userId: authTokens.userId, expiresAt: authTokens.expiresAt })
      .from(authTokens)
      .where(and(eq(authTokens.tokenHash, hash), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) return null;
    await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
    return row.userId;
  } catch {
    return null;
  }
}
