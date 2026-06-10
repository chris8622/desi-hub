import { requireAuth } from "@/lib/server-auth";

const PINTEREST_KEY = "desi_pinterest_v1";

function getUpstashConfig(): { url: string; token: string } | null {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export async function POST(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const cfg = getUpstashConfig();
  if (!cfg) return Response.json({ error: "KV nicht verfügbar" }, { status: 503 });

  await fetch(`${cfg.url}/del/${encodeURIComponent(PINTEREST_KEY)}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(8000),
  });

  return Response.json({ success: true });
}
