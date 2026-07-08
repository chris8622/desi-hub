import { createHash, timingSafeEqual } from "crypto";
import { auth } from "@/auth";

// Konstantzeit-Vergleich zweier Strings (verhindert Timing-Angriffe auf das
// Passwort). Beide Seiten werden zuerst gehasht → gleiche Länge, kein Längen-Leak.
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// req.json() abgesichert — bei ungültigem JSON null statt geworfenem 500.
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

// Zentraler Auth-Check für alle Kunden-API-Routen (Phase 1: Auth.js-Session).
// FAIL-CLOSED: keine gültige Session mit tenantId → 401. Der frühere
// x-app-token/APP_PASSWORD-Mechanismus ist mit dem Login-Cutover abgelöst.
// Gibt null zurück, wenn authentifiziert, sonst eine 401-Response.
export async function requireAuth(_req?: Request): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// Wie requireAuth, aber gibt bei Erfolg den Tenant-Kontext zurück (für die
// tenant-bezogene Datenschicht in den folgenden Increments).
export async function getSessionContext(): Promise<
  { tenantId: string; userId: string; role: string } | Response
> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    role: session.user.role,
  };
}
