import { requireAuth } from "@/lib/server-auth";
import { getFlags, MODULE_KEYS, moduleEnabled } from "@/lib/flags";

// Client-Sicht auf die Flags: welche Module sind aktiv, Banner-Text, Status.
// Nur für die UX (Sidebar ausblenden, Banner zeigen). Die eigentliche
// Durchsetzung passiert serverseitig via guardFeature() in den API-Routen.
export async function GET(req: Request) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const flags = await getFlags();
  const modules: Record<string, boolean> = {};
  for (const k of MODULE_KEYS) modules[k] = moduleEnabled(flags, k);

  return Response.json({
    modules,
    banner: flags.banner || "",
    status: flags.status,
  });
}
