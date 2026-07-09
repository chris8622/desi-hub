import { requireAdmin, writeAudit } from "@/lib/admin";
import { readJson } from "@/lib/server-auth";
import { getWorkspace, setWorkspace, createBackup, getBackupData } from "@/lib/db/workspace";

export const maxDuration = 30;

// POST { tenantId, action: "reset" | "restore", backupId?: string }
// Jede destruktive Aktion legt vorher einen Undo-Snapshot in workspace_backups an.
export async function POST(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await readJson<{ tenantId?: string; action?: string; backupId?: string }>(req);
  if (!body || !body.tenantId || (body.action !== "reset" && body.action !== "restore")) {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const tenantId = body.tenantId;

  try {
    const current = await getWorkspace(tenantId);
    const currentData = current?.data ?? {};

    if (body.action === "reset") {
      await createBackup(tenantId, "vor Leeren", currentData);
      await setWorkspace(tenantId, {});
      await writeAudit(req, "data_reset", `tenant=${tenantId.slice(0, 8)} · Daten geleert (Undo gesichert)`);
      return Response.json({ ok: true, action: "reset" });
    }

    // restore
    const backupId = (body.backupId || "").trim();
    if (!backupId) return Response.json({ error: "Kein Backup gewählt." }, { status: 400 });
    const data = await getBackupData(tenantId, backupId);
    if (data === null) return Response.json({ error: "Backup nicht gefunden." }, { status: 404 });

    await createBackup(tenantId, "vor Einspielen", currentData);
    await setWorkspace(tenantId, data);
    await writeAudit(req, "data_restore", `tenant=${tenantId.slice(0, 8)} · Backup eingespielt`);
    return Response.json({ ok: true, action: "restore" });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
