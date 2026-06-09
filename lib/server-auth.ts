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
  if (req.headers.get("x-app-token") !== appPassword) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // authentifiziert
}
