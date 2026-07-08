import { getSessionContext } from "@/lib/server-auth";
import { getEntitlements, MODULE_KEYS, moduleEnabled } from "@/lib/flags";

// Client-Sicht auf die Flags des eingeloggten Tenants: welche Module aktiv,
// Banner, Status. Nur für die UX (Sidebar/Banner). Durchsetzung serverseitig
// via guardFeature() in den API-Routen.
export async function GET() {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  const flags = await getEntitlements(ctx.tenantId);
  const modules: Record<string, boolean> = {};
  for (const k of MODULE_KEYS) modules[k] = moduleEnabled(flags, k);

  return Response.json({
    modules,
    banner: flags.banner || "",
    status: flags.status,
  });
}
