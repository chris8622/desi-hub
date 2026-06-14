import { requireAuth } from "@/lib/server-auth";

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

function buildSystemPrompt(bv?: BrandVoice): string {
  const name     = bv?.name || "Desi";
  const niche    = bv?.niche || "Mind, Health, Aesthetics, Self-Improvement";
  const tone     = VOICE_LABELS[bv?.voice || ""] || bv?.voice || "warm, persönlich, inspirierend";
  const audience = bv?.audience || "Frauen 25–40";
  let p = `Du bist Content-Assistent für ${name} (Nische: ${niche}, Zielgruppe: ${audience}, Ton: ${tone}).`;
  if (bv?.brand_keywords?.trim()) p += ` Lieblingsworte: ${bv.brand_keywords}.`;
  if (bv?.brand_avoid?.trim())    p += ` NICHT verwenden: ${bv.brand_avoid}.`;
  p += " Antworte mit validem JSON, ohne Markdown-Codeblöcke.";
  return p;
}

export async function POST(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const { sourceText, formats, groqKey: clientKey, brandVoice } = await req.json() as {
    sourceText: string;
    formats: string[];
    groqKey?: string;
    brandVoice?: BrandVoice;
  };

  const groqKey = clientKey || process.env.GROQ_API_KEY || "";
  if (!groqKey) return Response.json({ error: "Kein Groq API Key." }, { status: 400 });
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

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: buildSystemPrompt(brandVoice) },
        { role: "user",   content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(50000),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    return Response.json({ error: `Groq-Fehler: ${err}` }, { status: 500 });
  }

  const data = await groqRes.json() as { choices: { message: { content: string } }[]; usage?: { total_tokens?: number } };
  const content = data.choices?.[0]?.message?.content || "{}";

  try {
    const result = JSON.parse(content);
    result._tokens = data.usage?.total_tokens || 0;
    return Response.json(result);
  } catch {
    return Response.json({ error: "Antwort konnte nicht verarbeitet werden", raw: content }, { status: 500 });
  }
}
