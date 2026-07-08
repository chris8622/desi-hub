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
  "dh_instagram_handle", // wurde bisher nicht synchronisiert (Audit B5)
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

// Dirty-Flag: es gibt lokale Änderungen, die noch NICHT auf dem Server sind.
// Verhindert Datenverlust — solange dirty, darf der Server-Stand die lokalen
// Daten nicht überschreiben.
const DIRTY_KEY = "desi_dirty";
function isDirty(): boolean {
  try { return localStorage.getItem(DIRTY_KEY) === "1"; } catch { return false; }
}
function setDirty(v: boolean): void {
  try { if (v) localStorage.setItem(DIRTY_KEY, "1"); else localStorage.removeItem(DIRTY_KEY); } catch {}
}

// Live-Sync-Status an die Oberfläche melden (Footer in LoginGate).
export type SyncStatus = "syncing" | "synced" | "local" | "error";
function notify(status: SyncStatus, message?: string): void {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent("desi-sync", { detail: { status, message } })); } catch {}
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

// Debounce-Timer (Modul-Ebene → überlebt Client-Navigation)
let syncTimer: ReturnType<typeof setTimeout> | null = null;

// Ausstehenden Upload SOFORT ausführen (leert den Debounce-Timer).
// Wird vor jedem syncDown aufgerufen, damit lokale Änderungen nicht vom
// Server-Stand überschrieben werden.
export async function flushSyncUp(): Promise<void> {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  if (isDirty()) await syncUp();
}

// Vom Server laden (beim Login / App-Start / Seitenwechsel)
export async function syncDown(): Promise<{ success: boolean; available: boolean }> {
  // Erst ausstehende lokale Änderungen hochladen — sonst überschreibt der
  // Server-Stand sie (das war der Datenverlust-Weg beim schnellen Seitenwechsel).
  if (isDirty()) {
    await flushSyncUp();
    // Ging der Upload nicht durch (offline/Fehler), bleibt lokal dirty →
    // NICHT mit dem Server-Stand überschreiben, lokale Daten gewinnen.
    if (isDirty()) return { success: false, available: true };
  }
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
  if (typeof window === "undefined") return { success: false, available: false };
  try {
    notify("syncing");
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
      setDirty(false); // lokale Änderung wird zugunsten des Server-Stands verworfen
      await syncDown();
      if (typeof window !== "undefined") {
        try { sessionStorage.setItem("desi_sync_conflict", "1"); } catch {}
        window.location.reload();
      }
      return { success: false, available: true, conflict: true };
    }

    const result = await res.json() as { available: boolean; saved?: boolean; updatedAt?: number; error?: string };
    if (result.saved) {
      setDirty(false);
      if (result.updatedAt) setLastSyncedAt(result.updatedAt);
      notify("synced");
      return { success: true, available: true };
    }
    if (result.available === false) {
      // KV nicht konfiguriert → nur lokal, kein Fehler
      notify("local");
      return { success: false, available: false };
    }
    // z. B. 413 (zu groß) oder anderer Server-Fehler → dirty bleibt, sichtbar melden
    notify("error", result.error || "Synchronisierung fehlgeschlagen.");
    return { success: false, available: true };
  } catch {
    notify("error", "Keine Verbindung zum Sync-Server.");
    return { success: false, available: false };
  }
}

// Debounced syncUp — verhindert zu viele Anfragen beim schnellen Tippen.
// Markiert sofort als dirty, damit ein Seitenwechsel/Tab-Schließen vor Ablauf
// des Timers die Änderung noch rettet (flushSyncUp / flushOnHide).
export function scheduleSyncUp(delayMs = 3000): void {
  if (typeof window === "undefined") return;
  setDirty(true);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = null; syncUp(); }, delayMs);
}

// Best-Effort-Upload beim Verlassen/Verstecken der Seite (Tab schließen,
// App in den Hintergrund). keepalive erlaubt den Request über das Entladen
// hinweg (Limit 64 KB — größere Payloads rettet der flush beim nächsten Start).
export function flushOnHide(): void {
  if (typeof window === "undefined" || !isDirty()) return;
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  try {
    const data = readAllLocal();
    fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": getAuthToken(),
        "x-last-synced-at": String(getLastSyncedAt()),
      },
      body: JSON.stringify(data),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
