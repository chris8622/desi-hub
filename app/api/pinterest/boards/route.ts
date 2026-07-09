import { requireAuth } from "@/lib/server-auth";
import { getUpstashConfig, getValidToken, pinterestEnabled } from "@/lib/pinterest";

export async function GET(req: Request) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  if (!pinterestEnabled()) return Response.json({ error: "Pinterest ist derzeit nicht verfügbar." }, { status: 503 });

  const cfg = getUpstashConfig();
  if (!cfg) return Response.json({ error: "KV nicht verfügbar" }, { status: 503 });

  // Holt gültigen Token — erneuert abgelaufene automatisch (Auto-Refresh)
  const tokenData = await getValidToken(cfg);
  if (!tokenData?.access_token) {
    return Response.json({ error: "Pinterest nicht verbunden — bitte in den Einstellungen (neu) verbinden." }, { status: 401 });
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
