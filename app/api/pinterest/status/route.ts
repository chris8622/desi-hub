import { requireAuth } from "@/lib/server-auth";
import { getUpstashConfig, getValidToken, getStoredToken } from "@/lib/pinterest";

export async function GET(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const configured = !!(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET && process.env.PINTEREST_CALLBACK_URL);

  if (!configured) {
    return Response.json({ configured: false, connected: false });
  }

  const cfg = getUpstashConfig();
  if (!cfg) {
    return Response.json({ configured, connected: false, reason: "KV nicht verfügbar" });
  }

  try {
    // Nie verbunden ≠ abgelaufen: erst Rohbestand prüfen, dann validieren.
    const stored = await getStoredToken(cfg);
    if (!stored) {
      return Response.json({ configured, connected: false });
    }
    // getValidToken erneuert abgelaufene Tokens automatisch — „expired" ist nur
    // noch true, wenn auch der Refresh fehlschlägt (dann: neu verbinden).
    const token = await getValidToken(cfg);
    if (!token?.access_token) {
      return Response.json({ configured, connected: false, expired: true });
    }

    return Response.json({
      configured,
      connected: true,
      expired: false,
      username: token.username || "",
      stored_at: token.stored_at,
    });
  } catch {
    return Response.json({ configured, connected: false });
  }
}
