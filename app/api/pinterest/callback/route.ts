// Pinterest OAuth Callback — wird vom Browser nach Pinterest-Autorisierung aufgerufen.
// Kein requireAuth (Browser-Redirect, kein x-app-token).
// Schutz via state-Abgleich gegen KV.

const PINTEREST_KEY = "desi_pinterest_v1";
const STATE_KEY     = "desi_pinterest_state";

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

async function kvSet(cfg: { url: string; token: string }, key: string, value: unknown): Promise<void> {
  await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(8000),
  });
}

async function kvDel(cfg: { url: string; token: string }, key: string): Promise<void> {
  await fetch(`${cfg.url}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(5000),
  });
}

export async function GET(req: Request) {
  const settingsUrl = "/settings?pinterest=";

  if (process.env.PINTEREST_ENABLED !== "true") {
    return Response.redirect(new URL(`${settingsUrl}error`, req.url));
  }

  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return Response.redirect(new URL(`${settingsUrl}denied`, req.url));
  }
  if (!code || !state) {
    return Response.redirect(new URL(`${settingsUrl}error`, req.url));
  }

  const appId       = process.env.PINTEREST_APP_ID;
  const appSecret   = process.env.PINTEREST_APP_SECRET;
  const callbackUrl = process.env.PINTEREST_CALLBACK_URL;

  if (!appId || !appSecret || !callbackUrl) {
    return Response.redirect(new URL(`${settingsUrl}misconfigured`, req.url));
  }

  const cfg = getUpstashConfig();
  if (!cfg) {
    return Response.redirect(new URL(`${settingsUrl}error`, req.url));
  }

  // State validieren
  try {
    const storedState = await kvGet(cfg, STATE_KEY);
    if (storedState !== state) {
      return Response.redirect(new URL(`${settingsUrl}invalid_state`, req.url));
    }
    await kvDel(cfg, STATE_KEY);
  } catch {
    return Response.redirect(new URL(`${settingsUrl}error`, req.url));
  }

  // Code gegen Access Token tauschen
  try {
    const basic = Buffer.from(`${appId}:${appSecret}`).toString("base64");
    const body  = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl });

    const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        Authorization:  `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const tokenData = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Pinterest token error:", tokenData);
      return Response.redirect(new URL(`${settingsUrl}token_error`, req.url));
    }

    // Nutzer-Info holen
    let username = "";
    try {
      const meRes = await fetch("https://api.pinterest.com/v5/user_account", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(8000),
      });
      const me = await meRes.json() as { username?: string };
      username = me.username || "";
    } catch {}

    // Token in KV speichern
    await kvSet(cfg, PINTEREST_KEY, {
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in:    tokenData.expires_in,
      scope:         tokenData.scope,
      stored_at:     Date.now(),
      username,
    });

    return Response.redirect(new URL(`${settingsUrl}connected`, req.url));
  } catch (e) {
    console.error("Pinterest callback error:", e);
    return Response.redirect(new URL(`${settingsUrl}error`, req.url));
  }
}
