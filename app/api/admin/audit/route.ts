import { requireAdmin, getAudit } from "@/lib/admin";

// GET: die letzten Admin-Aktionen (wer/wann/was).
export async function GET(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const entries = await getAudit();
  return Response.json({ entries });
}
