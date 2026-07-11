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

// ─── Live-Prüfung eines Kunden-Keys (beim Speichern) ─────
// Minimaler Chat-Aufruf (2 Tokens, auf Kosten des Kunden-Keys — Centbruchteile).
// Nur eine eindeutige Ablehnung (401/403) gilt als „Key ungültig"; alles andere
// (Netzwerk, 5xx, Modellproblem) ist kein Beweis → speichern mit Hinweis, damit
// ein Anbieter-Ausfall nie eine Kundin mit gültigem Schlüssel blockiert.
const PROBE_MODELS: Record<Provider, string> = {
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-haiku-4-5-20251001",
  perplexity: "sonar-pro",
};

export type KeyProbe = { valid: boolean; authFail: boolean; message?: string };

export async function probeKey(provider: Provider, key: string): Promise<KeyProbe> {
  const cfg = PROVIDERS[provider];
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: PROBE_MODELS[provider],
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 2,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) return { valid: true, authFail: false };
    const authFail = res.status === 401 || res.status === 403;
    let message = `Status ${res.status}`;
    try {
      const e = await res.json() as { error?: { message?: string } };
      if (e?.error?.message) message = e.error.message;
    } catch {}
    return { valid: false, authFail, message };
  } catch (e) {
    // Timeout/Netzwerk — kein Urteil über den Key möglich.
    return { valid: false, authFail: false, message: (e as Error).message };
  }
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
