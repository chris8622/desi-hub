export const maxDuration = 30;

// Graceful import — wenn KV nicht konfiguriert ist, wird es undefined
let kv: { get: (k: string) => Promise<unknown>; set: (k: string, v: unknown) => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const kvModule = require("@vercel/kv");
  kv = kvModule.kv;
} catch {}

const DATA_KEY = "desi_hub_data_v1";

function authCheck(req: Request): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return true;
  return req.headers.get("x-app-token") === appPassword;
}

// ── GET: Daten vom Server laden ──────────────────────────
export async function GET(req: Request) {
  if (!authCheck(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!kv) return Response.json({ available: false }, { status: 200 });

  try {
    const data = await kv.get(DATA_KEY);
    return Response.json({ available: true, data: data || {} });
  } catch (e) {
    return Response.json({ available: false, error: (e as Error).message });
  }
}

// ── POST: Daten auf Server speichern ─────────────────────
export async function POST(req: Request) {
  if (!authCheck(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!kv) return Response.json({ available: false, saved: false });

  try {
    const data = await req.json();
    await kv.set(DATA_KEY, data);
    return Response.json({ available: true, saved: true });
  } catch (e) {
    return Response.json({ available: false, error: (e as Error).message });
  }
}
