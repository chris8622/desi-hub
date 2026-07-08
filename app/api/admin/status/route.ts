import { requireAdmin } from "@/lib/admin";
import { getKvConfig, kvGet } from "@/lib/kv";
import { getAiUsage, usageMonth } from "@/lib/flags";

const DATA_KEY = "desi_hub_data_v1";
const BACKUP_INDEX_KEY = "desi_hub_backup_index";
const LOGIN_LOG_KEY = "desi_login_log";

// Übersicht für die Konsole: KI-Verbrauch, Backups, letzte Aktivität, Datengröße.
export async function GET(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const month = usageMonth();
  const aiUsage = await getAiUsage(month);

  const cfg = getKvConfig();
  if (!cfg) {
    return Response.json({
      kvAvailable: false, month, aiUsage,
      backups: [], loginCount: 0, lastLogin: null, dataBytes: 0,
    });
  }

  let backups: string[] = [];
  let loginCount = 0;
  let lastLogin: number | null = null;
  let dataBytes = 0;

  try {
    const idx = (await kvGet(cfg, BACKUP_INDEX_KEY)) as string[] | null;
    backups = Array.isArray(idx) ? [...idx].sort().reverse() : [];
  } catch { /* egal */ }

  try {
    const log = (await kvGet(cfg, LOGIN_LOG_KEY)) as { ts: number; success: boolean }[] | null;
    if (Array.isArray(log)) {
      loginCount = log.length;
      const ok = log.filter(e => e.success).map(e => e.ts);
      lastLogin = ok.length ? Math.max(...ok) : null;
    }
  } catch { /* egal */ }

  try {
    const data = await kvGet(cfg, DATA_KEY);
    if (data) dataBytes = JSON.stringify(data).length;
  } catch { /* egal */ }

  return Response.json({
    kvAvailable: true, month, aiUsage, backups, loginCount, lastLogin, dataBytes,
  });
}
