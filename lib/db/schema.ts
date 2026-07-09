// ─── Postgres-Schema (Phase 1, Drizzle) ──────────────────
// Multi-Tenant-Fundament: jede Kundin = ein tenant. entitlements spiegeln die
// AdminFlags aus der Stufe-1-Konsole (Quelle wandert KV → hier, guardFeature bleibt).
// workspaces hält vorerst den Daten-Blob 1:1 wie bisher desi_hub_data_v1 —
// smoothe Migration ohne Datenverlust; Normalisierung kommt später.

import { sql } from "drizzle-orm";
import {
  pgTable, uuid, text, integer, jsonb, boolean, timestamp, primaryKey,
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("starter"), // Plan-ID: starter | pro | studio
  status: text("status").notNull().default("active"), // active | readonly | locked (Betreiber-Override)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  // ── Abrechnung / Abo ──
  // trialing | active | past_due | canceled | comped (Freischaltung ohne Zahlung)
  subscriptionStatus: text("subscription_status").notNull().default("trialing"),
  billingInterval: text("billing_interval"),                 // month | year
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  discountPercent: integer("discount_percent").notNull().default(0), // manueller Admin-Rabatt
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("member"), // owner | admin | member
  passwordHash: text("password_hash"),
  agbAcceptedAt: timestamp("agb_accepted_at", { withTimezone: true }), // Nachweis AGB-Zustimmung
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const entitlements = pgTable("entitlements", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  modules: jsonb("modules").notNull().default(sql`'{}'::jsonb`),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  aiMonthlyLimit: integer("ai_monthly_limit").notNull().default(0), // 0 = unbegrenzt
  banner: text("banner").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usage = pgTable("usage", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // YYYY-MM
  aiCalls: integer("ai_calls").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.tenantId, t.month] })]);

export const workspaces = pgTable("workspaces", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Einmal-Tokens für Passwort-Reset & Einladung. Gespeichert wird nur der
// sha256-Hash des Tokens (DB-Leak → keine nutzbaren Tokens). purpose: reset|invite.
export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Kundeneigene KI-Keys (BYOK), verschlüsselt (AES-256-GCM). Eine Zeile pro
// Tenant+Provider. ciphertext = v1:<iv>:<tag>:<ct> (siehe lib/crypto.ts).
export const tenantSecrets = pgTable("tenant_secrets", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  ciphertext: text("ciphertext").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.provider] })]);

// On-Demand-Snapshots für die Admin-Konsole (Undo vor Reset/Restore).
export const workspaceBackups = pgTable("workspace_backups", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
