import { requireAdmin, writeAudit } from "@/lib/admin";
import { readJson } from "@/lib/server-auth";
import { getFlags, setFlags, normalizeFlags } from "@/lib/flags";

// GET: aktuelle Flags (voll) für die Konsole.
export async function GET(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const flags = await getFlags();
  return Response.json({ flags });
}

// POST: Flags setzen. Eingabe wird normalisiert (nie roh übernehmen).
export async function POST(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const body = await readJson<{ flags: unknown }>(req);
  if (!body || !body.flags) {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const next = normalizeFlags(body.flags);
  next.updatedAt = Date.now();

  try {
    await setFlags(next);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }

  const disabledModules = Object.entries(next.modules)
    .filter(([, v]) => v === false)
    .map(([k]) => k);
  await writeAudit(
    req,
    "flags_update",
    `status=${next.status} · ai=${next.ai.enabled ? "an" : "aus"}` +
      `${next.ai.monthlyLimit ? `(Limit ${next.ai.monthlyLimit})` : ""}` +
      `${disabledModules.length ? ` · gesperrt: ${disabledModules.join(",")}` : ""}` +
      `${next.banner ? " · Banner gesetzt" : ""}`,
  );

  return Response.json({ ok: true, flags: next });
}
