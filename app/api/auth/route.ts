export const maxDuration = 10;

const LOG_KEY = "desi_login_log";
const MAX_ENTRIES = 25;

function getUpstashConfig(): { url: string; token: string } | null {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvGet(cfg: { url: string; token: string }, key: string): Promise<unknown> {
  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json() as { result: string | null };
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
}

async function kvSet(cfg: { url: string; token: string }, key: string, value: unknown): Promise<void> {
  await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(5000),
  });
}

function parseDevice(ua: string): string {
  if (!ua) return "🌐 Unbekannt";
  if (/iPhone/i.test(ua))  return "📱 iPhone";
  if (/iPad/i.test(ua))    return "📱 iPad";
  if (/Android/i.test(ua)) return "📱 Android";
  if (/Mac OS/i.test(ua)) {
    if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return "💻 Chrome / Mac";
    if (/Firefox/i.test(ua)) return "💻 Firefox / Mac";
    if (/Safari/i.test(ua))  return "🍎 Safari / Mac";
    return "💻 Mac";
  }
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua))  return "🖥️ Chrome / Windows";
    if (/Firefox/i.test(ua)) return "🖥️ Firefox / Windows";
    if (/Edge/i.test(ua))    return "🖥️ Edge / Windows";
    return "🖥️ Windows";
  }
  if (/Linux/i.test(ua)) return "🐧 Linux";
  return "🌐 Unbekannt";
}

async function geoLookup(ip: string): Promise<{ city?: string; country?: string }> {
  if (!ip || ip === "?" || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { city: "Lokal", country: "" };
  }
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { "User-Agent": "desi-hub/1.0" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return {};
    const data = await res.json() as { city?: string; country_name?: string; country_code?: string; error?: boolean };
    if (data.error) return {};
    return { city: data.city || "", country: data.country_code || data.country_name || "" };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const { password } = await req.json() as { password?: string };
  const correct = process.env.APP_PASSWORD;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "?";
  const ua = req.headers.get("user-agent") || "";

  if (!correct || password !== correct) {
    const cfg = getUpstashConfig();
    if (cfg) {
      const [existing, geo] = await Promise.all([
        kvGet(cfg, LOG_KEY) as Promise<LoginEntry[] | null>,
        geoLookup(ip),
      ]);
      const entry: LoginEntry = { ts: Date.now(), ip, device: parseDevice(ua), success: false, ...geo };
      await kvSet(cfg, LOG_KEY, [entry, ...(existing || [])].slice(0, MAX_ENTRIES));
    }
    return Response.json({ ok: false }, { status: 401 });
  }

  const cfg = getUpstashConfig();
  if (cfg) {
    try {
      const [existing, geo] = await Promise.all([
        kvGet(cfg, LOG_KEY) as Promise<LoginEntry[] | null>,
        geoLookup(ip),
      ]);
      const entry: LoginEntry = { ts: Date.now(), ip, device: parseDevice(ua), success: true, ...geo };
      await kvSet(cfg, LOG_KEY, [entry, ...(existing || [])].slice(0, MAX_ENTRIES));
    } catch {}
  }

  return Response.json({ ok: true });
}

type LoginEntry = { ts: number; ip: string; device: string; success: boolean; city?: string; country?: string };
