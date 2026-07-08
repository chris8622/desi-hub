// Einmaliger DB-Smoke-Test gegen Neon: Tabellen da? Insert/Select/Delete ok?
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name`;
console.log("Tabellen:", tables.map(t => t.table_name).join(", "));

// Roundtrip: Tenant + Entitlements + Workspace anlegen, lesen, wieder löschen.
const [t] = await sql`
  INSERT INTO tenants (slug, name) VALUES ('smoke-test', 'Smoke Test')
  RETURNING id, slug, status, plan, created_at`;
console.log("Tenant angelegt:", t.id, "| status:", t.status, "| plan:", t.plan);

await sql`INSERT INTO entitlements (tenant_id) VALUES (${t.id})`;
await sql`INSERT INTO workspaces (tenant_id, data) VALUES (${t.id}, ${JSON.stringify({ hello: "world" })})`;

const [w] = await sql`SELECT data FROM workspaces WHERE tenant_id = ${t.id}`;
const [e] = await sql`SELECT modules, ai_enabled, ai_monthly_limit FROM entitlements WHERE tenant_id = ${t.id}`;
console.log("Workspace-Data:", JSON.stringify(w.data), "| Entitlements ai_enabled:", e.ai_enabled, "modules:", JSON.stringify(e.modules));

// Cascade-Delete testen (löscht entitlements + workspace mit)
await sql`DELETE FROM tenants WHERE id = ${t.id}`;
const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM workspaces WHERE tenant_id = ${t.id}`;
console.log("Nach Tenant-Delete verbleibende Workspaces (soll 0):", count);
console.log("✓ DB-Smoke-Test bestanden");
