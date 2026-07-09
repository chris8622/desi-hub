import { requireAuth } from "@/lib/server-auth";
import { getUpstashConfig, getValidToken, pinterestEnabled } from "@/lib/pinterest";

export const maxDuration = 30;

export async function POST(req: Request) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  if (!pinterestEnabled()) return Response.json({ error: "Pinterest ist derzeit nicht verfügbar." }, { status: 503 });

  const cfg = getUpstashConfig();
  if (!cfg) return Response.json({ error: "KV nicht verfügbar" }, { status: 503 });

  // Holt gültigen Token — erneuert abgelaufene automatisch (Auto-Refresh)
  const tokenData = await getValidToken(cfg);
  if (!tokenData?.access_token) {
    return Response.json({ error: "Pinterest nicht verbunden — bitte zuerst in den Einstellungen verbinden" }, { status: 401 });
  }

  let body: {
    board_id: string;
    title: string;
    description: string;
    image_base64: string; // "data:image/png;base64,..."
    link?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  if (!body.board_id || !body.title || !body.image_base64) {
    return Response.json({ error: "board_id, title und image_base64 sind erforderlich" }, { status: 400 });
  }

  // base64-Prefix entfernen wenn vorhanden
  const base64Data = body.image_base64.replace(/^data:image\/[a-z]+;base64,/, "");

  try {
    const pinBody: Record<string, unknown> = {
      title:       body.title,
      description: body.description || "",
      board_id:    body.board_id,
      media_source: {
        source_type:  "image_base64",
        content_type: "image/png",
        data:         base64Data,
      },
    };

    if (body.link) pinBody.link = body.link;

    const res = await fetch("https://api.pinterest.com/v5/pins", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pinBody),
      signal: AbortSignal.timeout(25000),
    });

    const data = await res.json() as { id?: string; link?: string; message?: string };

    if (!res.ok) {
      return Response.json({ error: data.message || `Pinterest API Fehler ${res.status}` }, { status: res.status });
    }

    return Response.json({
      success: true,
      pin_id:  data.id,
      pin_url: data.link || `https://pinterest.com/pin/${data.id}`,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
