import { requireAdmin } from "@/lib/admin";
import { listTenants } from "@/lib/flags";

// GET: alle Mandanten (für die Auswahl in der Konsole).
export async function GET(req: Request) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const tenants = await listTenants();
  return Response.json({ tenants });
}
