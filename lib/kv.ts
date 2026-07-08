// ─── Gemeinsame Upstash-KV-Schicht ───────────────────────
// Zentralisiert den REST-Zugriff, den bisher jede Route selbst hatte
// (sync, login-log). Neue Admin-/Flag-Bausteine nutzen dieselben Helfer.
//
// FAIL-SOFT: Ist KV nicht konfiguriert (lokal), liefert getKvConfig() null —
// Aufrufer entscheiden dann selbst (meist fail-open für Flags, fail-safe für Writes).

export type KvConfig = { url: string; token: string };

export function getKvConfig(): KvConfig | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export async function kvGet(cfg: KvConfig, key: string): Promise<unknown> {
  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KV GET failed: ${res.status}`);
  const json = (await res.json()) as { result: string | null };
  if (!json.result) return null;
  // result ist der gespeicherte String. Einmal parsen → Objekt.
  // Falls noch doppelt-codiert (alte Daten): nochmal parsen.
  let parsed: unknown = JSON.parse(json.result);
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { /* war doch ein String */ }
  }
  return parsed;
}

export async function kvSet(cfg: KvConfig, key: string, value: unknown): Promise<void> {
  const res = await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "text/plain" },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KV SET failed: ${res.status}`);
}

export async function kvDel(cfg: KvConfig, key: string): Promise<void> {
  try {
    await fetch(`${cfg.url}/del/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* Löschen ist Best-Effort */ }
}
