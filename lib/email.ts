// ─── E-Mail-Versand (Resend) ─────────────────────────────
// DEV-FALLBACK: ohne RESEND_API_KEY wird nichts gesendet, sondern der Inhalt in
// die Server-Logs geschrieben — so ist der Flow lokal testbar ohne echten Versand.

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Basis-URL aus den Request-Headern (hinter Vercel-Proxy korrekt).
export function baseUrl(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Schlichtes, markenkonformes E-Mail-Layout.
export function emailShell(title: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#2C2016">
  <div style="font-family:Georgia,serif;font-size:22px;color:#C4704A;margin-bottom:4px">Contentraum</div>
  <div style="font-size:12px;color:#8C7B6B;margin-bottom:24px">Wo Ideen Raum finden</div>
  <h2 style="font-size:18px;color:#2C2016;margin:0 0 12px">${title}</h2>
  <div style="font-size:14px;line-height:1.6;color:#2C2016">${bodyHtml}</div>
  ${cta ? `<div style="margin:24px 0"><a href="${cta.href}" style="background:#C4704A;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;display:inline-block">${cta.label}</a></div>
  <div style="font-size:12px;color:#8C7B6B">Falls der Button nicht geht, kopiere diesen Link:<br><span style="word-break:break-all">${cta.href}</span></div>` : ""}
  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #DDD5C8;font-size:11px;color:#8C7B6B">made with ❤️ by Toelsner Digital · toelsner.at</div>
</div>`;
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_RESEND_FROM || "Contentraum <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[email:dev] → ${opts.to} · ${opts.subject}\n${opts.html}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`E-Mail-Versand fehlgeschlagen (${res.status}) ${t.slice(0, 120)}`);
  }
}
