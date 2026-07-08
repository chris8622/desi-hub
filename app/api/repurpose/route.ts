import { requireAuth, readJson } from "@/lib/server-auth";
import { aiLimiter, checkRateLimit, getClientIp, tooManyRequests } from "@/lib/ratelimit";
import { chat, extractJson, pickModel } from "@/lib/llm";

export const maxDuration = 60;

type BrandVoice = {
  name?: string; niche?: string; voice?: string;
  audience?: string; topics?: string[];
  brand_keywords?: string; brand_avoid?: string;
};

const VOICE_LABELS: Record<string, string> = {
  "warm-inspirierend":  "warm, persönlich, ehrlich, inspirierend",
  "sachlich-kompetent": "sachlich, faktenbasiert, professionell, klar",
  "direkt-motivierend": "direkt, energetisch, antreibend, kurze Sätze",
  "sanft-einfühlsam":   "sanft, verständnisvoll, nährend, viel Empathie",
};

// Keine personenspezifischen Fallbacks — fehlende Angaben werden weggelassen.
function buildSystemPrompt(bv?: BrandVoice): string {
  const name     = bv?.name?.trim();
  const niche    = bv?.niche?.trim();
  const tone     = VOICE_LABELS[bv?.voice || ""] || bv?.voice?.trim() || "warm, persönlich, inspirierend";
  const audience = bv?.audience?.trim();
  const parts: string[] = [];
  if (niche)    parts.push(`Nische: ${niche}`);
  if (audience) parts.push(`Zielgruppe: ${audience}`);
  parts.push(`Ton: ${tone}`);
  let p = `Du bist Content-Assistent für ${name || "eine:n deutschsprachige:n Content-Creator:in"} (${parts.join(", ")}).`;
  if (bv?.brand_keywords?.trim()) p += ` Lieblingsworte: ${bv.brand_keywords}.`;
  if (bv?.brand_avoid?.trim())    p += ` NICHT verwenden: ${bv.brand_avoid}.`;
  p += " Antworte mit validem JSON, ohne Markdown-Codeblöcke.";
  return p;
}

export async function POST(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const rl = await checkRateLimit(aiLimiter, getClientIp(req));
  if (!rl.ok) {
    return tooManyRequests(rl.retryAfterSec, "Zu viele KI-Anfragen in kurzer Zeit. Bitte warte einen Moment und versuche es erneut.");
  }

  const body = await readJson<{ sourceText: string; formats: string[]; brandVoice?: BrandVoice; provider?: string; model?: string }>(req);
  if (!body) return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  const { sourceText, formats, brandVoice } = body;
  const { provider, model } = pickModel(body);

  if (!sourceText?.trim()) return Response.json({ error: "Kein Quelltext." }, { status: 400 });
  if (!formats?.length) return Response.json({ error: "Kein Format gewählt." }, { status: 400 });

  const formatInstructions: Record<string, string> = {
    instagram: `"instagram_caption": "Instagram-Caption (persönlich, mit Emojis, 80-120 Wörter, endet mit Frage an Community)",
  "instagram_hashtags": ["hashtag1", "hashtag2"]`,
    newsletter: `"newsletter_subject": "Betreff (neugierig, max 50 Zeichen)",
  "newsletter_preheader": "Preheader (max 90 Zeichen)",
  "newsletter_body": "Newsletter-Text (ca. 250-350 Wörter, HTML-Tags erlaubt: <p><ul><li><strong>)"`,
    pinterest: `"pinterest_title": "SEO-Pin-Titel mit Keywords (max 100 Zeichen)",
  "pinterest_description": "SEO-Beschreibung (max 500 Zeichen, natürlich formuliert, CTA am Ende)"`,
    blog_intro: `"blog_title": "Packender SEO-Titel (max 60 Zeichen)",
  "blog_intro": "Packende Einleitung (4-5 Sätze, persönliche Geschichte oder Frage, sofort fesselnd)"`,
  };

  const selectedInstructions = formats
    .filter(f => formatInstructions[f])
    .map(f => formatInstructions[f])
    .join(",\n  ");

  const prompt = `Du bekommst folgenden Originaltext und sollst ihn in verschiedene Content-Formate umwandeln.

ORIGINALTEXT:
${sourceText.slice(0, 6000)}

Wandle den Inhalt in diese Formate um. Behalte den Kern und die wichtigsten Aussagen bei, passe aber Ton und Länge ans jeweilige Format an.

Antworte mit JSON:
{
  ${selectedInstructions}
}`;

  try {
    const { text, tokens } = await chat({
      provider, model,
      system: buildSystemPrompt(brandVoice), user: prompt,
      temperature: 0.7, maxTokens: 3000, json: true,
    });
    const result = extractJson<Record<string, unknown>>(text);
    result._tokens = tokens;
    return Response.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json({ error: msg }, { status: /nicht konfiguriert/.test(msg) ? 503 : 500 });
  }
}
