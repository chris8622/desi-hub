import { requireAdmin } from "@/lib/admin";
import { getAiUsage, usageMonth } from "@/lib/flags";
import { getWorkspace, listBackups } from "@/lib/db/workspace";

// Übersicht für die Konsole, pro Tenant: KI-Verbrauch, Datengröße, Backups.
export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const tenantId = new URL(req.url).searchParams.get("tenantId");
  if (!tenantId) return Response.json({ error: "tenantId fehlt." }, { status: 400 });

  const month = usageMonth();
  const aiUsage = await getAiUsage(tenantId, month);

  let dataBytes = 0;
  let updatedAt = 0;
  try {
    const ws = await getWorkspace(tenantId);
    if (ws) {
      dataBytes = JSON.stringify(ws.data).length;
      updatedAt = ws.updatedAt;
    }
  } catch { /* egal */ }

  const backups = await listBackups(tenantId).catch(() => []);

  return Response.json({ month, aiUsage, dataBytes, updatedAt, backups });
}
