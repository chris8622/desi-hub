// Seed: Desis Tenant + Owner-User + Entitlements + leeren Workspace.
// Idempotent — legt nur an, was fehlt. Passwort-Hash wie lib/password.ts (scrypt).
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
dotenv.config({ path: ".env.local" });

const scryptAsync = promisify(scrypt);
async function hashPassword(pw) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const SLUG = "desi";
const EMAIL = "desi@contentraum.at";
const PASSWORD = "desi2024"; // ihr bestehendes Passwort → nahtloser Cutover

const existing = await sql`SELECT id FROM tenants WHERE slug = ${SLUG}`;
let tenantId;
if (existing.length) {
  tenantId = existing[0].id;
  console.log("Tenant existiert bereits:", tenantId);
} else {
  const [t] = await sql`INSERT INTO tenants (slug, name, plan) VALUES (${SLUG}, ${"Desiree Maxa"}, ${"pro"}) RETURNING id`;
  tenantId = t.id;
  await sql`INSERT INTO entitlements (tenant_id) VALUES (${tenantId})`;
  await sql`INSERT INTO workspaces (tenant_id, data) VALUES (${tenantId}, ${JSON.stringify({})})`;
  console.log("Tenant angelegt:", tenantId);
}

const userRows = await sql`SELECT id FROM users WHERE email = ${EMAIL}`;
if (userRows.length) {
  console.log("User existiert bereits:", EMAIL);
} else {
  const hash = await hashPassword(PASSWORD);
  await sql`INSERT INTO users (tenant_id, email, name, role, password_hash)
            VALUES (${tenantId}, ${EMAIL}, ${"Desiree"}, ${"owner"}, ${hash})`;
  console.log("User angelegt:", EMAIL, "| Passwort:", PASSWORD);
}
console.log("✓ Seed fertig");
