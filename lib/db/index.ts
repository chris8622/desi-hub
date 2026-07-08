// ─── DB-Client (Neon serverless über HTTP) ───────────────
// HTTP-Treiber ist ideal für Vercel-Serverless (kein Connection-Pooling-Overhead).
// Nutzt die „pooled" DATABASE_URL. Platzhalter-Fallback verhindert, dass Build/CI
// ohne gesetzte DB crasht — echte Queries laufen nur zur Laufzeit mit echter URL.

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

export const dbConfigured = !!url;

export const db = drizzle(
  neon(url ?? "postgresql://placeholder:placeholder@localhost/placeholder"),
  { schema },
);

export { schema };
