// ─── Kundeneigene KI-Keys (BYOK) ─────────────────────────
// Pro Tenant+Provider ein verschlüsselter Key in Postgres. Der Server nutzt den
// Kunden-Key wenn vorhanden, sonst den Operator-Key (process.env) — „Hybrid".
// Klartext-Keys verlassen den Server nie Richtung Client.

import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { tenantSecrets } from "./db/schema";
import { encryptSecret, decryptSecret, isEncryptionConfigured } from "./crypto";
import { PROVIDERS, type Provider } from "./llm";

// Kunden-Key (entschlüsselt) oder null, wenn keiner hinterlegt / nicht möglich.
export async function getTenantKey(tenantId: string, provider: Provider): Promise<string | null> {
  if (!isEncryptionConfigured()) return null;
  try {
    const rows = await db
      .select({ ct: tenantSecrets.ciphertext })
      .from(tenantSecrets)
      .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.provider, provider)))
      .limit(1);
    if (!rows[0]) return null;
    return decryptSecret(rows[0].ct);
  } catch {
    return null;
  }
}

export async function setTenantKey(tenantId: string, provider: Provider, key: string): Promise<void> {
  const ct = encryptSecret(key);
  await db
    .insert(tenantSecrets)
    .values({ tenantId, provider, ciphertext: ct })
    .onConflictDoUpdate({
      target: [tenantSecrets.tenantId, tenantSecrets.provider],
      set: { ciphertext: ct, updatedAt: new Date() },
    });
}

export async function deleteTenantKey(tenantId: string, provider: Provider): Promise<void> {
  await db
    .delete(tenantSecrets)
    .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.provider, provider)));
}

// Welche Provider hat der Tenant selbst hinterlegt (nur Status, nie der Key).
export async function getKeyStatus(tenantId: string): Promise<Record<Provider, boolean>> {
  const status = Object.fromEntries(
    (Object.keys(PROVIDERS) as Provider[]).map(p => [p, false]),
  ) as Record<Provider, boolean>;
  try {
    const rows = await db
      .select({ provider: tenantSecrets.provider })
      .from(tenantSecrets)
      .where(eq(tenantSecrets.tenantId, tenantId));
    for (const r of rows) {
      if (r.provider in status) status[r.provider as Provider] = true;
    }
  } catch { /* leer lassen */ }
  return status;
}
