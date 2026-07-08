import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// drizzle-kit läuft außerhalb von Next → .env.local explizit laden.
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrationen/DDL über die DIREKTE Verbindung (nicht den Pooler).
  dbCredentials: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || "" },
});
