import { requireAuth } from "@/lib/server-auth";

const PINTEREST_KEY = "desi_pinterest_v1";
const STATE_KEY     = "desi_pinterest_state";

function getUpstashConfig(): { url: string; token: string } | null {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvSet(cfg: { url: string; token: string }, key: string, value: unknown, exSeconds?: number): Promise<void> {
  await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(8000),
  });
  if (exSeconds) {
    await fetch(`${cfg.url}/expire/${encodeURIComponent(key)}/${exSeconds}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(5000),
    });
  }
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

export async function GET(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const appId       = process.env.PINTEREST_APP_ID;
  const appSecret   = process.env.PINTEREST_APP_SECRET;
  const callbackUrl = process.env.PINTEREST_CALLBACK_URL;

  if (!appId || !appSecret || !callbackUrl) {
    return Response.json({ configured: false, error: "Pinterest-Zugangsdaten fehlen (PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_CALLBACK_URL)" });
  }

  // Status prüfen
  const { searchParams } = new URL(req.url);
  if (searchParams.get("check") === "1") {
    const cfg = getUpstashConfig();
    if (!cfg) return Response.json({ configured: true, connected: false });
    try {
      const token = await kvGet(cfg, PINTEREST_KEY) as { access_token?: string; username?: string } | null;
      return Response.json({ configured: true, connected: !!token?.access_token, username: token?.username });
    } catch {
      return Response.json({ configured: true, connected: false });
    }
  }

  // State generieren + in KV speichern (10 min TTL)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const cfg = getUpstashConfig();
  if (cfg) {
    await kvSet(cfg, STATE_KEY, state, 600);
  }

  const url = new URL("https://www.pinterest.com/oauth/");
  url.searchParams.set("client_id",     appId);
  url.searchParams.set("redirect_uri",  callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope",         "boards:read,pins:write");
  url.searchParams.set("state",         state);

  return Response.json({ configured: true, authUrl: url.toString() });
}

// Gespeichertes Token lesen — intern, kein Export
export { PINTEREST_KEY, getUpstashConfig, kvGet, kvSet };
