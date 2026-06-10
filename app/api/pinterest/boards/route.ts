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

export async function GET(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const cfg = getUpstashConfig();
  if (!cfg) return Response.json({ error: "KV nicht verfügbar" }, { status: 503 });

  const tokenData = await kvGet(cfg, PINTEREST_KEY) as { access_token?: string } | null;
  if (!tokenData?.access_token) {
    return Response.json({ error: "Pinterest nicht verbunden" }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.pinterest.com/v5/boards?page_size=50&privacy_filter=all", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.json() as { message?: string };
      return Response.json({ error: err.message || `Pinterest API Fehler ${res.status}` }, { status: res.status });
    }

    const data = await res.json() as {
      items?: { id: string; name: string; privacy?: string }[];
    };

    const boards = (data.items || []).map(b => ({ id: b.id, name: b.name, privacy: b.privacy }));
    return Response.json({ boards });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
