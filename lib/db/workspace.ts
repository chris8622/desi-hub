// ─── Workspace-Datenzugriff (pro Tenant) ─────────────────
// Der Daten-Blob der Kundin liegt jetzt in Postgres (workspaces.data), nicht
// mehr im globalen KV-Key. Ein Zeile pro Tenant. Ersetzt den KV-Pfad im Sync.

import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { workspaces, workspaceBackups } from "./schema";

export type WorkspaceSnapshot = { data: Record<string, unknown>; updatedAt: number };

export async function getWorkspace(tenantId: string): Promise<WorkspaceSnapshot | null> {
  const rows = await db.select().from(workspaces).where(eq(workspaces.tenantId, tenantId)).limit(1);
  const w = rows[0];
  if (!w) return null;
  return {
    data: (w.data as Record<string, unknown>) ?? {},
    updatedAt: w.updatedAt ? new Date(w.updatedAt).getTime() : 0,
  };
}

export async function setWorkspace(tenantId: string, data: unknown): Promise<number> {
  const now = new Date();
  await db
    .insert(workspaces)
    .values({ tenantId, data, updatedAt: now })
    .onConflictDoUpdate({ target: workspaces.tenantId, set: { data, updatedAt: now } });
  return now.getTime();
}

export function isEmpty(data: unknown): boolean {
  return !data || typeof data !== "object" || Object.keys(data as object).length === 0;
}

// ── Backups (On-Demand-Snapshots für die Admin-Konsole) ──
const BACKUP_KEEP = 20; // pro Tenant die letzten N behalten

export async function createBackup(tenantId: string, label: string, data: unknown): Promise<void> {
  await db.insert(workspaceBackups).values({ tenantId, label, data });
  // Alte über die Grenze hinaus aufräumen
  const rows = await db
    .select({ id: workspaceBackups.id })
    .from(workspaceBackups)
    .where(eq(workspaceBackups.tenantId, tenantId))
    .orderBy(desc(workspaceBackups.createdAt));
  const stale = rows.slice(BACKUP_KEEP).map(r => r.id);
  for (const id of stale) {
    await db.delete(workspaceBackups).where(eq(workspaceBackups.id, id));
  }
}

export type BackupMeta = { id: string; label: string; createdAt: number };
export async function listBackups(tenantId: string): Promise<BackupMeta[]> {
  const rows = await db
    .select({ id: workspaceBackups.id, label: workspaceBackups.label, createdAt: workspaceBackups.createdAt })
    .from(workspaceBackups)
    .where(eq(workspaceBackups.tenantId, tenantId))
    .orderBy(desc(workspaceBackups.createdAt));
  return rows.map(r => ({ id: r.id, label: r.label, createdAt: r.createdAt ? new Date(r.createdAt).getTime() : 0 }));
}

export async function getBackupData(tenantId: string, backupId: string): Promise<Record<string, unknown> | null> {
  const rows = await db
    .select({ data: workspaceBackups.data })
    .from(workspaceBackups)
    .where(and(eq(workspaceBackups.id, backupId), eq(workspaceBackups.tenantId, tenantId)))
    .limit(1);
  return rows[0] ? ((rows[0].data as Record<string, unknown>) ?? {}) : null;
}
