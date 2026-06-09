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
];

function getAuthToken(): string {
  try { return localStorage.getItem("desi_auth_token") || ""; } catch { return ""; }
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
    const result = await res.json() as { available: boolean; data?: unknown };
    if (!result.available) return { success: false, available: false };
    // data kann (durch alte Daten) noch ein String sein → robust parsen
    let data = result.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { data = null; }
    }
    if (data && typeof data === "object") writeAllLocal(data as Record<string, unknown>);
    return { success: true, available: true };
  } catch {
    return { success: false, available: false };
  }
}

// Auf Server speichern (nach jeder Änderung — debounced im Aufrufer)
export async function syncUp(): Promise<{ success: boolean; available: boolean }> {
  try {
    const data = readAllLocal();
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-token": getAuthToken() },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(8000),
    });
    const result = await res.json() as { available: boolean; saved?: boolean };
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
