import { requireAuth } from "@/lib/server-auth";
import { guardFeature } from "@/lib/flags";

export const maxDuration = 30;

const DATA_KEY = "desi_hub_data_v1";
const BACKUP_INDEX_KEY = "desi_hub_backup_index";
const BACKUP_PREFIX = "desi_hub_backup_"; // + YYYY-MM-DD
const BACKUP_KEEP_DAYS = 14;
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

// Wrapper-Form in KV: { updatedAt: number, data: {...} }
type Wrapper = { updatedAt: number; data: unknown };

// Upstash REST API direkt — kein Package nötig
function getUpstashConfig(): { url: string; token: string } | null {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvGet(cfg: { url: string; token: string }, key: string): Promise<unknown> {
  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KV GET failed: ${res.status}`);
  const json = await res.json() as { result: string | null };
  if (!json.result) return null;
  // result ist der gespeicherte String. Einmal parsen → Objekt.
  // Falls noch doppelt-codiert (alte Daten): nochmal parsen.
  let parsed: unknown = JSON.parse(json.result);
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { /* war doch ein String */ }
  }
  return parsed;
}

async function kvSet(cfg: { url: string; token: string }, key: string, value: unknown): Promise<void> {
  const res = await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KV SET failed: ${res.status}`);
}

async function kvDel(cfg: { url: string; token: string }, key: string): Promise<void> {
  try {
    await fetch(`${cfg.url}/del/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* Löschen ist Best-Effort */ }
}

// Wrapper robust auspacken (abwärtskompatibel mit altem Roh-Format)
function unwrap(raw: unknown): { data: unknown; updatedAt: number } {
  if (raw && typeof raw === "object" && "data" in raw && "updatedAt" in raw) {
    const w = raw as Wrapper;
    return { data: w.data ?? {}, updatedAt: Number(w.updatedAt) || 0 };
  }
  // Altes Format: der gespeicherte Wert IST die Daten (kein updatedAt bekannt)
  return { data: raw ?? {}, updatedAt: 0 };
}

// Heutiges Datum (UTC) als YYYY-MM-DD
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Tages-Backup schreiben + alte (>14 Tage) opportunistisch löschen
async function writeDailyBackup(cfg: { url: string; token: string }, wrapper: Wrapper): Promise<void> {
  try {
    const today = todayKey();
    const index = (await kvGet(cfg, BACKUP_INDEX_KEY)) as string[] | null;
    const dates = Array.isArray(index) ? index : [];

    if (!dates.includes(today)) {
      await kvSet(cfg, `${BACKUP_PREFIX}${today}`, wrapper);
      dates.push(today);
    }

    // Prune: alles älter als BACKUP_KEEP_DAYS entfernen
    const cutoff = Date.now() - BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000;
    const keep: string[] = [];
    for (const d of dates) {
      const ts = new Date(d + "T00:00:00Z").getTime();
      if (isNaN(ts) || ts < cutoff) {
        await kvDel(cfg, `${BACKUP_PREFIX}${d}`);
      } else {
        keep.push(d);
      }
    }
    await kvSet(cfg, BACKUP_INDEX_KEY, keep);
  } catch { /* Backup ist Best-Effort, darf den Sync nicht blockieren */ }
}

// ── GET: Daten vom Server laden ──────────────────────────
export async function GET(req: Request) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const cfg = getUpstashConfig();
  if (!cfg) return Response.json({ available: false, reason: "KV not configured" });

  try {
    const raw = await kvGet(cfg, DATA_KEY);
    const { data, updatedAt } = unwrap(raw);
    return Response.json({ available: true, data: data || {}, updatedAt });
  } catch (e) {
    return Response.json({ available: false, error: (e as Error).message });
  }
}

// ── POST: Daten auf Server speichern ─────────────────────
export async function POST(req: Request) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  // Nur-Lese-/Sperr-Status blockt jeden Schreibvorgang (Admin-Flags)
  const featureBlock = await guardFeature({ write: true });
  if (featureBlock) return featureBlock;

  const cfg = getUpstashConfig();
  if (!cfg) return Response.json({ available: false, saved: false, reason: "KV not configured" });

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
    const existing = unwrap(await kvGet(cfg, DATA_KEY));
    // Server hat einen NEUEREN Stand als der Client zuletzt gesehen hat → Konflikt
    if (existing.updatedAt > 0 && clientLastSynced > 0 && existing.updatedAt > clientLastSynced) {
      return Response.json(
        { available: true, saved: false, conflict: true, serverUpdatedAt: existing.updatedAt,
          error: "Ein neuerer Stand existiert bereits auf dem Server." },
        { status: 409 },
      );
    }
  } catch { /* wenn der Vergleich scheitert, trotzdem schreiben (fail-open) */ }

  try {
    const wrapper: Wrapper = { updatedAt: Date.now(), data };
    await kvSet(cfg, DATA_KEY, wrapper);
    await writeDailyBackup(cfg, wrapper);
    return Response.json({ available: true, saved: true, updatedAt: wrapper.updatedAt });
  } catch (e) {
    return Response.json({ available: false, saved: false, error: (e as Error).message });
  }
}
