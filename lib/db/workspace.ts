// ─── Workspace-Datenzugriff (pro Tenant) ─────────────────
// Der Daten-Blob der Kundin liegt jetzt in Postgres (workspaces.data), nicht
// mehr im globalen KV-Key. Ein Zeile pro Tenant. Ersetzt den KV-Pfad im Sync.

import { eq } from "drizzle-orm";
import { db } from "./index";
import { workspaces } from "./schema";

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
