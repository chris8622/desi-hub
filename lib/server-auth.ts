import { createHash, timingSafeEqual } from "crypto";

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

// Zentraler Auth-Check für alle API-Routen.
// FAIL-CLOSED: Ist APP_PASSWORD nicht konfiguriert, wird ALLES abgelehnt —
// sonst wären die Routen (die serverseitige API-Keys proxen) öffentlich nutzbar.
export function requireAuth(req: Request): Response | null {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return Response.json(
      { error: "Server nicht konfiguriert (APP_PASSWORD fehlt)" },
      { status: 503 },
    );
  }
  const token = req.headers.get("x-app-token") || "";
  if (!safeEqual(token, appPassword)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // authentifiziert
}
