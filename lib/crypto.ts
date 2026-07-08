// ─── Secret-Verschlüsselung (AES-256-GCM) ────────────────
// Für kundeneigene KI-Keys (BYOK). Der Klartext-Key wird NIE gespeichert und
// NIE an den Client zurückgegeben — nur verschlüsselt in Postgres. Schlüssel-
// material: sha256(ENCRYPTION_KEY) → 32 Byte (ENCRYPTION_KEY darf ein beliebig
// langer Zufalls-String sein, z. B. `openssl rand -base64 32`).

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY fehlt");
  return createHash("sha256").update(raw).digest(); // 32 Byte
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}

// Format: v1:<iv>:<authTag>:<ciphertext> (alle base64)
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Unbekanntes Secret-Format");
  const [, ivB, tagB, ctB] = parts;
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}
