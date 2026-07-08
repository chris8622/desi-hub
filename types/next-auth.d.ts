import type { DefaultSession } from "next-auth";

// Session/JWT um tenantId + role erweitern (Multi-Tenant-Scoping).
declare module "next-auth" {
  interface Session {
    user: { id: string; tenantId: string; role: string } & DefaultSession["user"];
  }
  interface User {
    tenantId: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    tenantId?: string;
    role?: string;
  }
}
