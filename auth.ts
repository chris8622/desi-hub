// ─── Auth.js v5 — Credentials (E-Mail + Passwort), tenant-scoped ──
// JWT-Sessions (kein DB-Session-Store nötig). Der Token trägt tenantId + role,
// damit serverseitige Guards (Phase 2: guardFeature aus Postgres) den Mandanten
// kennen. Magic-Link/Reset via Resend kommt später — Passwort reicht zum Start.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/password";
import { authLimiter, checkRateLimit, getClientIp } from "@/lib/ratelimit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // 30 Tage Sitzung, täglich verlängert bei Aktivität.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds, request) => {
        // Brute-Force-Schutz: max. 5 Versuche pro IP / 15 min. Während der Sperre
        // schlägt JEDER Login fehl (auch der richtige) → Rate-Limit greift wirklich.
        const rl = await checkRateLimit(authLimiter, getClientIp(request as Request));
        if (!rl.ok) return null;

        const email = String(creds?.email || "").toLowerCase().trim();
        const password = String(creds?.password || "");
        if (!email || !password) return null;

        const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = rows[0];
        if (!user || !user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid ?? "");
        session.user.tenantId = String(token.tenantId ?? "");
        session.user.role = String(token.role ?? "member");
      }
      return session;
    },
  },
});
