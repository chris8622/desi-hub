// ─── Pinterest Token-Verwaltung (mit Auto-Refresh) ───────
// Zentraler Zugriff auf den gespeicherten OAuth-Token. Läuft der Access-Token
// ab (Pinterest: ~30 Tage), wird er automatisch über den Refresh-Token erneuert —
// die Nutzerin muss NICHT mehr manuell neu verbinden (Audit-/H1-Backlog-Punkt).

const PINTEREST_KEY = "desi_pinterest_v1";
// 10-Minuten-Puffer: lieber etwas zu früh erneuern als mit abgelaufenem Token anfragen
const EXPIRY_BUFFER_MS = 10 * 60 * 1000;

// LAUNCH-SICHERHEIT: Der Token liegt aktuell unter EINEM globalen Key — im
// Mehrkundenbetrieb würde Kundin B damit Desis Konto überschreiben/bespielen.
// Deshalb standardmäßig AUS; nur mit PINTEREST_ENABLED="true" aktiv (z. B. in
// einer Single-Tenant-Instanz). Sauberer Umbau auf Token-pro-Tenant = P1.
export function pinterestEnabled(): boolean {
  return process.env.PINTEREST_ENABLED === "true";
}

export type PinterestToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;   // Sekunden ab stored_at
  scope?: string;
  stored_at?: number;    // Unix-ms
  username?: string;
};

type KvConfig = { url: string; token: string };

export function getUpstashConfig(): KvConfig | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export async function kvGet(cfg: KvConfig, key: string): Promise<unknown> {
  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json() as { result: string | null };
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return json.result; }
}

export async function kvSet(cfg: KvConfig, key: string, value: unknown): Promise<void> {
  await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(8000),
  });
}

function isExpired(t: PinterestToken): boolean {
  if (!t.stored_at || !t.expires_in) return false; // Alt-Token ohne Metadaten: optimistisch nutzen
  return Date.now() > t.stored_at + t.expires_in * 1000 - EXPIRY_BUFFER_MS;
}

// Access-Token per Refresh-Token erneuern und in KV zurückschreiben.
async function refreshToken(cfg: KvConfig, old: PinterestToken): Promise<PinterestToken | null> {
  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;
  if (!appId || !appSecret || !old.refresh_token) return null;

  try {
    const basic = Buffer.from(`${appId}:${appSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: old.refresh_token,
    });
    const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json() as {
      access_token?: string; refresh_token?: string; expires_in?: number; scope?: string;
    };
    if (!res.ok || !data.access_token) return null;

    const fresh: PinterestToken = {
      access_token: data.access_token,
      // Pinterest liefert beim Refresh nicht immer einen neuen Refresh-Token → alten behalten
      refresh_token: data.refresh_token || old.refresh_token,
      expires_in: data.expires_in,
      scope: data.scope || old.scope,
      stored_at: Date.now(),
      username: old.username,
    };
    await kvSet(cfg, PINTEREST_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

// Roh gespeicherter Token (ohne Gültigkeitsprüfung) — für Status-Anzeigen.
export async function getStoredToken(cfg: KvConfig): Promise<PinterestToken | null> {
  const stored = await kvGet(cfg, PINTEREST_KEY) as PinterestToken | null;
  return stored?.access_token ? stored : null;
}

// Liefert einen GÜLTIGEN Access-Token (erneuert bei Bedarf automatisch)
// oder null, wenn nicht verbunden / Refresh fehlgeschlagen.
export async function getValidToken(cfg: KvConfig): Promise<PinterestToken | null> {
  const stored = await getStoredToken(cfg);
  if (!stored) return null;
  if (!isExpired(stored)) return stored;
  return refreshToken(cfg, stored);
}
