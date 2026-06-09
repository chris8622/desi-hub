export function getLS<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
export function setLS(key: string, val: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch { return false; } // z.B. QuotaExceeded
}
