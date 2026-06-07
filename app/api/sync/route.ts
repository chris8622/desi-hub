export const maxDuration = 30;

const DATA_KEY = "desi_hub_data_v1";

function authCheck(req: Request): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return true;
  return req.headers.get("x-app-token") === appPassword;
}

// Upstash REST API direkt — kein Package nötig
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
  if (!res.ok) throw new Error(`KV GET failed: ${res.status}`);
  const json = await res.json() as { result: string | null };
  if (!json.result) return null;
  // result ist der gespeicherte String. Einmal parsen → Objekt.
  // Falls noch doppelt-codiert (alte Daten): nochmal parsen.
  let parsed: unknown = JSON.parse(json.result);
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { /* war doch ein String */ }
  }
  return parsed;
}

async function kvSet(cfg: { url: string; token: string }, key: string, value: unknown): Promise<void> {
  // Upstash REST SET: der Request-Body wird als Wert gespeichert.
  // Wir speichern das Objekt als EINFACHEN JSON-String.
  const res = await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KV SET failed: ${res.status}`);
}

// ── GET: Daten vom Server laden ──────────────────────────
export async function GET(req: Request) {
  if (!authCheck(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getUpstashConfig();
  if (!cfg) return Response.json({ available: false, reason: "KV not configured" });

  try {
    const data = await kvGet(cfg, DATA_KEY);
    return Response.json({ available: true, data: data || {} });
  } catch (e) {
    return Response.json({ available: false, error: (e as Error).message });
  }
}

// ── POST: Daten auf Server speichern ─────────────────────
export async function POST(req: Request) {
  if (!authCheck(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getUpstashConfig();
  if (!cfg) return Response.json({ available: false, saved: false, reason: "KV not configured" });

  try {
    const data = await req.json();
    await kvSet(cfg, DATA_KEY, data);
    return Response.json({ available: true, saved: true });
  } catch (e) {
    return Response.json({ available: false, saved: false, error: (e as Error).message });
  }
}
