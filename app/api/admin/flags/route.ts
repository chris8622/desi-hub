import { requireAdmin, writeAudit } from "@/lib/admin";
import { readJson } from "@/lib/server-auth";
import { getEntitlements, setEntitlements, normalizeFlags } from "@/lib/flags";

// GET ?tenantId=… : Entitlements eines Tenants für die Konsole.
export async function GET(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const tenantId = new URL(req.url).searchParams.get("tenantId");
  if (!tenantId) return Response.json({ error: "tenantId fehlt." }, { status: 400 });

  const flags = await getEntitlements(tenantId);
  return Response.json({ flags });
}

// POST { tenantId, flags } : Entitlements setzen. Eingabe wird normalisiert.
export async function POST(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const body = await readJson<{ tenantId?: string; flags: unknown }>(req);
  if (!body || !body.tenantId || !body.flags) {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const next = normalizeFlags(body.flags);
  next.updatedAt = Date.now();

  try {
    await setEntitlements(body.tenantId, next);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }

  const disabledModules = Object.entries(next.modules)
    .filter(([, v]) => v === false)
    .map(([k]) => k);
  await writeAudit(
    req,
    "flags_update",
    `tenant=${body.tenantId.slice(0, 8)} · status=${next.status} · ai=${next.ai.enabled ? "an" : "aus"}` +
      `${next.ai.monthlyLimit ? `(Limit ${next.ai.monthlyLimit})` : ""}` +
      `${disabledModules.length ? ` · gesperrt: ${disabledModules.join(",")}` : ""}` +
      `${next.banner ? " · Banner gesetzt" : ""}`,
  );

  return Response.json({ ok: true, flags: next });
}
