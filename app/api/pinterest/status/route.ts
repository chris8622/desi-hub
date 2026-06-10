import { requireAuth } from "@/lib/server-auth";

const PINTEREST_KEY = "desi_pinterest_v1";

function getUpstashConfig(): { url: string; token: string } | null {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvGet(cfg: { url: string; token: string }, key: string): Promise<unknown> {
  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json() as { result: string | null };
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return json.result; }
}

type PinterestToken = {
  access_token: string;
  username?: string;
  stored_at?: number;
  expires_in?: number;
};

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
    const token = await kvGet(cfg, PINTEREST_KEY) as PinterestToken | null;
    if (!token?.access_token) {
      return Response.json({ configured, connected: false });
    }

    // Ablauf prüfen (Pinterest Standard: 1 Jahr)
    const expired = token.stored_at && token.expires_in
      ? Date.now() > token.stored_at + token.expires_in * 1000
      : false;

    return Response.json({
      configured,
      connected: true,
      expired,
      username: token.username || "",
      stored_at: token.stored_at,
    });
  } catch {
    return Response.json({ configured, connected: false });
  }
}
