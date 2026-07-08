// ─── Zentraler API-Client ────────────────────────────────
// Ein Ort für: Auth-Header, res.ok-Prüfung, Fehler-Übersetzung ins Deutsche,
// Timeouts und Session-Ablauf. Ersetzt ~18 handgeschriebene fetch-Aufrufe,
// von denen die meisten Fehlerantworten (429/413/503) still ignoriert haben.

export class ApiError extends Error {
  status: number;
  retryAfterSec?: number;
  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

function authToken(): string {
  try { return localStorage.getItem("desi_auth_token") || ""; } catch { return ""; }
}

// Session abgelaufen → aufräumen und Login zeigen.
function forceLogout(): void {
  try {
    localStorage.removeItem("desi_auth");
    localStorage.removeItem("desi_auth_token");
    localStorage.removeItem("desi_session_expires");
  } catch {}
  if (typeof window !== "undefined") window.location.reload();
}

type ApiOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
};

// Führt den Request aus und prüft die Antwort. Wirft ApiError mit deutscher
// Meldung. Gibt die rohe Response zurück (für JSON *und* Streams).
async function request(path: string, opts: ApiOptions = {}): Promise<Response> {
  const { method = "GET", body, timeoutMs = 60_000 } = opts;

  const headers: Record<string, string> = { "x-app-token": authToken() };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const aborted = (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";
    throw new ApiError(
      aborted ? "Die Anfrage hat zu lange gedauert. Bitte versuche es erneut."
              : "Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.",
      0,
    );
  }

  if (res.ok) return res;

  // Fehlerdetails aus dem Body holen (Routen antworten mit { error })
  let serverMsg = "";
  try {
    const data = await res.clone().json() as { error?: string };
    serverMsg = data?.error || "";
  } catch { /* z. B. HTML-Fehlerseite */ }

  // WICHTIG: 401 „Unauthorized" = App-Session abgelaufen (requireAuth).
  // Pinterest-Routen liefern ebenfalls 401, aber mit eigener Meldung
  // („nicht verbunden") — die darf NICHT ausloggen.
  if (res.status === 401 && serverMsg === "Unauthorized") {
    forceLogout();
    throw new ApiError("Deine Sitzung ist abgelaufen. Bitte melde dich neu an.", 401);
  }

  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get("Retry-After")) || 60;
    throw new ApiError(
      serverMsg || `Zu viele Anfragen. Bitte warte ${retryAfterSec} Sekunden.`,
      429,
      retryAfterSec,
    );
  }

  const fallback: Record<number, string> = {
    400: "Ungültige Anfrage.",
    403: "Kein Zugriff.",
    413: "Das Datenpaket ist zu groß.",
    500: "Serverfehler. Bitte versuche es erneut.",
    503: "Dienst gerade nicht verfügbar. Bitte später erneut versuchen.",
  };
  throw new ApiError(serverMsg || fallback[res.status] || `Fehler ${res.status}.`, res.status);
}

// JSON-Antwort holen (der Normalfall).
export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await request(path, opts);
  try {
    return await res.json() as T;
  } catch {
    throw new ApiError("Unerwartete Antwort vom Server.", res.status);
  }
}

// Server-Sent-Events-Stream (research, trends). Prüft vorher res.ok —
// Fehlerantworten sind JSON, kein Stream (das lief vorher ins Leere).
export async function apiStream(path: string, opts: ApiOptions = {}): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const res = await request(path, opts);
  if (!res.body) throw new ApiError("Server sendet keinen Datenstrom.", res.status);
  return res.body.getReader();
}

// Fehler → anzeigbare deutsche Meldung (auch für unerwartete Ausnahmen).
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Unbekannter Fehler. Bitte versuche es erneut.";
}
