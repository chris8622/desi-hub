import { getSessionContext } from "@/lib/server-auth";
import { guardFeature } from "@/lib/flags";
import { getWorkspace, setWorkspace, isEmpty } from "@/lib/db/workspace";
import { getKvConfig, kvGet } from "@/lib/kv";

export const maxDuration = 30;

const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const LEGACY_KV_KEY = "desi_hub_data_v1"; // Einmal-Import-Quelle (Phase-0-Blob)

// Antwortform bewusst identisch zum früheren KV-Sync — der Client (lib/sync.ts)
// bleibt unverändert: { available, data, updatedAt } bzw. { available, saved, ... }.

// Legacy-KV-Blob auspacken (Wrapper { updatedAt, data } oder Roh-Objekt)
function unwrapKv(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && "data" in raw) {
    return ((raw as { data?: unknown }).data as Record<string, unknown>) ?? {};
  }
  return (raw as Record<string, unknown>) ?? {};
}

// Einmaliger Import: ist der Postgres-Workspace leer, aber im KV liegt noch
// Desis alter Stand → übernehmen. Der KV-Blob bleibt als eingefrorenes Backup.
async function importFromKvIfEmpty(tenantId: string): Promise<Record<string, unknown> | null> {
  const cfg = getKvConfig();
  if (!cfg) return null;
  try {
    const legacy = unwrapKv(await kvGet(cfg, LEGACY_KV_KEY));
    if (isEmpty(legacy)) return null;
    await setWorkspace(tenantId, legacy);
    return legacy;
  } catch {
    return null;
  }
}

// ── GET: Daten des eingeloggten Tenants laden ────────────
export async function GET() {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  try {
    let ws = await getWorkspace(ctx.tenantId);

    // Workspace leer? → einmaliger Import aus dem alten KV-Blob.
    if (!ws || isEmpty(ws.data)) {
      const imported = await importFromKvIfEmpty(ctx.tenantId);
      if (imported) {
        ws = await getWorkspace(ctx.tenantId);
      }
    }

    return Response.json({
      available: true,
      data: ws?.data ?? {},
      updatedAt: ws?.updatedAt ?? 0,
    });
  } catch (e) {
    return Response.json({ available: false, error: (e as Error).message });
  }
}

// ── POST: Daten des eingeloggten Tenants speichern ───────
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  // Nur-Lese-/Sperr-Status blockt jeden Schreibvorgang (Admin-Flags)
  const featureBlock = await guardFeature(ctx.tenantId, { write: true });
  if (featureBlock) return featureBlock;

  // Payload-Größe begrenzen (schützt vor versehentlich riesigen Blobs)
  const bodyText = await req.text();
  if (bodyText.length > MAX_PAYLOAD_BYTES) {
    return Response.json(
      { available: true, saved: false, error: "Datenpaket zu groß (max. 2 MB). Bitte große Bilder aus dem Vision-Board entfernen." },
      { status: 413 },
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return Response.json({ available: true, saved: false, error: "Ungültige Daten." }, { status: 400 });
  }

  // Zeitstempel-Konflikt-Schutz (Last-Write-Wins verhindern)
  const clientLastSynced = Number(req.headers.get("x-last-synced-at")) || 0;
  try {
    const existing = await getWorkspace(ctx.tenantId);
    if (existing && existing.updatedAt > 0 && clientLastSynced > 0 && existing.updatedAt > clientLastSynced) {
      return Response.json(
        { available: true, saved: false, conflict: true, serverUpdatedAt: existing.updatedAt,
          error: "Ein neuerer Stand existiert bereits auf dem Server." },
        { status: 409 },
      );
    }
  } catch { /* wenn der Vergleich scheitert, trotzdem schreiben (fail-open) */ }

  try {
    const updatedAt = await setWorkspace(ctx.tenantId, data);
    return Response.json({ available: true, saved: true, updatedAt });
  } catch (e) {
    return Response.json({ available: false, saved: false, error: (e as Error).message });
  }
}
