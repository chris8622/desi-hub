import { listTenants } from "@/lib/flags";
import { getWorkspace, createBackup, listBackups, isEmpty } from "@/lib/db/workspace";

export const maxDuration = 60;

// Täglicher Auto-Snapshot je Tenant (Vercel Cron → siehe vercel.json, 03:00 UTC).
// Abgesichert über CRON_SECRET: Vercel sendet automatisch
// `Authorization: Bearer <CRON_SECRET>`, wenn die Env-Var gesetzt ist.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET nicht konfiguriert." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const label = `auto ${today}`;

  let done = 0, skipped = 0, failed = 0;
  try {
    const tenants = await listTenants();
    for (const t of tenants) {
      try {
        const ws = await getWorkspace(t.id);
        // Leere Workspaces nicht sichern; heutiges Auto-Backup nicht doppeln.
        if (!ws || isEmpty(ws.data)) { skipped++; continue; }
        const existing = await listBackups(t.id);
        if (existing.some(b => b.label === label)) { skipped++; continue; }
        await createBackup(t.id, label, ws.data);
        done++;
      } catch { failed++; }
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }

  return Response.json({ ok: true, date: today, done, skipped, failed });
}
