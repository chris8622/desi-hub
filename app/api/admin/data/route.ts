import { requireAdmin, writeAudit } from "@/lib/admin";
import { readJson } from "@/lib/server-auth";
import { getKvConfig, kvGet, kvSet } from "@/lib/kv";

export const maxDuration = 30;

const DATA_KEY = "desi_hub_data_v1";
const BACKUP_PREFIX = "desi_hub_backup_"; // + YYYY-MM-DD (Tages-Backups aus Phase 0)
const PRE_ACTION_KEY = "desi_hub_backup_pre_action"; // Ein-Schritt-Undo-Slot

type Wrapper = { updatedAt: number; data: unknown };

function unwrap(raw: unknown): Wrapper {
  if (raw && typeof raw === "object" && "data" in raw && "updatedAt" in raw) {
    const w = raw as Wrapper;
    return { updatedAt: Number(w.updatedAt) || 0, data: w.data ?? {} };
  }
  return { updatedAt: 0, data: raw ?? {} };
}

// Vor jeder destruktiven Aktion den aktuellen Stand in den Undo-Slot sichern.
async function snapshotCurrent(cfg: { url: string; token: string }): Promise<void> {
  const current = unwrap(await kvGet(cfg, DATA_KEY));
  await kvSet(cfg, PRE_ACTION_KEY, { updatedAt: Date.now(), data: current.data });
}

// POST { action: "reset" | "restore", date?: string }
// date: "YYYY-MM-DD" eines Tages-Backups oder "pre_action" für den Undo-Slot.
export async function POST(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const body = await readJson<{ action: string; date?: string }>(req);
  if (!body || (body.action !== "reset" && body.action !== "restore")) {
    return Response.json({ error: "Ungültige Aktion." }, { status: 400 });
  }

  const cfg = getKvConfig();
  if (!cfg) return Response.json({ error: "KV nicht konfiguriert." }, { status: 503 });

  try {
    if (body.action === "reset") {
      await snapshotCurrent(cfg);
      await kvSet(cfg, DATA_KEY, { updatedAt: Date.now(), data: {} });
      await writeAudit(req, "data_reset", "Daten geleert (Undo-Snapshot gesichert)");
      return Response.json({ ok: true, action: "reset" });
    }

    // restore
    const date = (body.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && date !== "pre_action") {
      return Response.json({ error: "Ungültiges Backup-Datum." }, { status: 400 });
    }
    const srcKey = date === "pre_action" ? PRE_ACTION_KEY : `${BACKUP_PREFIX}${date}`;
    const src = await kvGet(cfg, srcKey);
    if (!src) {
      return Response.json({ error: "Backup nicht gefunden." }, { status: 404 });
    }
    // aktuellen Stand vorm Überschreiben sichern → Restore ist ebenfalls umkehrbar
    await snapshotCurrent(cfg);
    const restored = unwrap(src);
    await kvSet(cfg, DATA_KEY, { updatedAt: Date.now(), data: restored.data });
    await writeAudit(req, "data_restore", `Backup ${date} eingespielt`);
    return Response.json({ ok: true, action: "restore", date });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
