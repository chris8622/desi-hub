// ─── Sync-Service: localStorage ↔ Vercel KV ─────────────
// Alle Keys die synchronisiert werden
export const SYNC_KEYS = [
  "dh_settings",
  "dh_ideenpool",
  "dh_planner",
  "dh_drafts",
  "dh_subscribers",
  "dh_newsletters",
  "dh_research_history",
  "dh_trusted_sources",
  "dh_trends_latest",
  "dh_carousels",
  "dh_pins",
  "dh_analytics",
  "dh_pinterest_board",
  "dh_hashtag_sets",
  "dh_caption_bank",
  "dh_vision",
  "dh_goals",
  "dh_checkins",
  "dh_vision_board",
];

function getAuthToken(): string {
  try { return localStorage.getItem("desi_auth_token") || ""; } catch { return ""; }
}

// Zeitstempel des zuletzt vom Server geladenen Stands — Basis für den
// Konflikt-Schutz (verhindert, dass ein veraltetes Gerät neuere Daten überschreibt).
const LAST_SYNCED_KEY = "desi_last_synced_at";
function getLastSyncedAt(): number {
  try { return Number(localStorage.getItem(LAST_SYNCED_KEY)) || 0; } catch { return 0; }
}
function setLastSyncedAt(ts: number): void {
  try { localStorage.setItem(LAST_SYNCED_KEY, String(ts)); } catch {}
}

function readAllLocal(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      data[key] = raw ? JSON.parse(raw) : null;
    } catch {}
  }
  return data;
}

function writeAllLocal(data: Record<string, unknown>): void {
  for (const key of SYNC_KEYS) {
    if (data[key] !== undefined && data[key] !== null) {
      try { localStorage.setItem(key, JSON.stringify(data[key])); } catch {}
    }
  }
}

// Vom Server laden (beim Login / App-Start)
export async function syncDown(): Promise<{ success: boolean; available: boolean }> {
  try {
    const res = await fetch("/api/sync", {
      headers: { "x-app-token": getAuthToken() },
      signal: AbortSignal.timeout(8000),
    });
    const result = await res.json() as { available: boolean; data?: unknown; updatedAt?: number };
    if (!result.available) return { success: false, available: false };
    // data kann (durch alte Daten) noch ein String sein → robust parsen
    let data = result.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { data = null; }
    }
    if (data && typeof data === "object") writeAllLocal(data as Record<string, unknown>);
    // Server-Stand merken → Basis für den Konflikt-Schutz beim nächsten Upload
    setLastSyncedAt(Number(result.updatedAt) || Date.now());
    return { success: true, available: true };
  } catch {
    return { success: false, available: false };
  }
}

// Auf Server speichern (nach jeder Änderung — debounced im Aufrufer)
export async function syncUp(): Promise<{ success: boolean; available: boolean; conflict?: boolean }> {
  try {
    const data = readAllLocal();
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": getAuthToken(),
        "x-last-synced-at": String(getLastSyncedAt()),
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(8000),
    });

    // Konflikt: ein anderes Gerät hat neuere Daten geschrieben.
    // Server-Stand gewinnt → herunterladen, dann Seite neu laden, damit die
    // Oberfläche den frischen Stand zeigt (kein blindes Überschreiben).
    if (res.status === 409) {
      await syncDown();
      if (typeof window !== "undefined") {
        try { sessionStorage.setItem("desi_sync_conflict", "1"); } catch {}
        window.location.reload();
      }
      return { success: false, available: true, conflict: true };
    }

    const result = await res.json() as { available: boolean; saved?: boolean; updatedAt?: number };
    if (result.saved && result.updatedAt) setLastSyncedAt(result.updatedAt);
    return { success: result.saved === true, available: result.available };
  } catch {
    return { success: false, available: false };
  }
}

// Debounced syncUp — verhindert zu viele Anfragen beim schnellen Tippen
let syncTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSyncUp(delayMs = 3000): void {
  if (typeof window === "undefined") return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    await syncUp();
  }, delayMs);
}
