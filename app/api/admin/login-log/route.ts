import { requireAuth } from "@/lib/server-auth";

export async function GET(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return Response.json({ entries: [] });

  try {
    const res = await fetch(`${url}/get/${encodeURIComponent("desi_login_log")}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json() as { result: string | null };
    const entries = json.result ? JSON.parse(json.result) : [];
    return Response.json({ entries });
  } catch {
    return Response.json({ entries: [] });
  }
}
