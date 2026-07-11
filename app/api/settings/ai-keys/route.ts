import { getSessionContext, readJson } from "@/lib/server-auth";
import { getKeyStatus, setTenantKey, deleteTenantKey, probeKey } from "@/lib/aikeys";
import { isEncryptionConfigured } from "@/lib/crypto";
import { PROVIDERS, type Provider } from "@/lib/llm";

function validProvider(p: unknown): p is Provider {
  return typeof p === "string" && p in PROVIDERS;
}

// GET: welche Provider hat der eingeloggte Tenant selbst hinterlegt (nur Status).
export async function GET() {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;
  const status = await getKeyStatus(ctx.tenantId);
  return Response.json({ status, configured: isEncryptionConfigured() });
}

// POST { provider, key }: eigenen Key hinterlegen (wird verschlüsselt gespeichert).
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  if (!isEncryptionConfigured()) {
    return Response.json({ error: "Serverseitige Verschlüsselung ist nicht konfiguriert." }, { status: 503 });
  }

  const body = await readJson<{ provider?: unknown; key?: unknown }>(req);
  if (!body || !validProvider(body.provider)) {
    return Response.json({ error: "Unbekannter Anbieter." }, { status: 400 });
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key || key.length > 500) {
    return Response.json({ error: "Ungültiger Schlüssel." }, { status: 400 });
  }

  // Live-Prüfung: nur eine eindeutige Anbieter-Ablehnung verhindert das Speichern.
  const probe = await probeKey(body.provider, key);
  if (!probe.valid && probe.authFail) {
    return Response.json({
      error: `Der Anbieter hat diesen Schlüssel abgelehnt${probe.message ? ` (${probe.message})` : ""}. Bitte prüfe ihn und versuche es erneut.`,
    }, { status: 400 });
  }

  try {
    await setTenantKey(ctx.tenantId, body.provider, key);
    return Response.json({
      ok: true,
      provider: body.provider,
      verified: probe.valid,
      // Prüfung nicht möglich (Netzwerk/Anbieter) → trotzdem speichern, aber ehrlich sagen.
      note: probe.valid ? undefined : "Gespeichert — die Live-Prüfung war gerade nicht möglich. Beim ersten Einsatz siehst du, ob der Schlüssel funktioniert.",
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE { provider }: eigenen Key entfernen (fällt auf Operator-Key zurück).
export async function DELETE(req: Request) {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  const body = await readJson<{ provider?: unknown }>(req);
  if (!body || !validProvider(body.provider)) {
    return Response.json({ error: "Unbekannter Anbieter." }, { status: 400 });
  }
  try {
    await deleteTenantKey(ctx.tenantId, body.provider);
    return Response.json({ ok: true, provider: body.provider });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
