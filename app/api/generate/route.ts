import { getSessionContext, readJson } from "@/lib/server-auth";
import { aiLimiter, checkRateLimit, getClientIp, tooManyRequests } from "@/lib/ratelimit";
import { chat, extractJson, pickModel } from "@/lib/llm";
import { guardFeature, incrAiUsage } from "@/lib/flags";

export const maxDuration = 60;

type BrandVoice = {
  name?: string; niche?: string; voice?: string;
  audience?: string; topics?: string[];
  brand_keywords?: string; brand_avoid?: string;
};

const VOICE_LABELS: Record<string, string> = {
  "warm-inspirierend":   "warm, persönlich, ehrlich, inspirierend — nie zu formal, nie zu lässig",
  "sachlich-kompetent":  "sachlich, faktenbasiert, professionell und klar — aber mit Herz",
  "direkt-motivierend":  "direkt, energetisch, antreibend — kurze Sätze, kraftvolle Worte",
  "sanft-einfühlsam":    "sanft, verständnisvoll, nährend — ruhige Sprache, viel Empathie",
};

// Baut den System-Prompt aus der Brand Voice der Nutzerin.
// WICHTIG: Keine personenspezifischen Fallbacks — fehlt eine Angabe,
// wird die Zeile weggelassen (neutral), statt ein fremdes Profil anzunehmen.
function buildSystemPrompt(bv?: BrandVoice): string {
  const name     = bv?.name?.trim();
  const niche    = bv?.niche?.trim();
  const tone     = VOICE_LABELS[bv?.voice || ""] || bv?.voice?.trim() || "warm, persönlich, ehrlich, inspirierend";
  const audience = bv?.audience?.trim();
  const topics   = bv?.topics?.length ? bv.topics.join(", ") : "";

  let prompt = name
    ? `Du bist Content-Assistent für ${name}, eine:n deutschsprachige:n Content-Creator:in.`
    : `Du bist Content-Assistent für eine:n deutschsprachige:n Content-Creator:in.`;
  if (niche)    prompt += `\nNische: ${niche}.`;
  if (topics)   prompt += `\nKernthemen: ${topics}.`;
  prompt += `\nTon: ${tone}.`;
  if (audience) prompt += `\nZielgruppe: ${audience}.`;

  if (bv?.brand_keywords?.trim()) {
    prompt += `\nLieblingswörter & Phrasen: ${bv.brand_keywords}.`;
  }
  if (bv?.brand_avoid?.trim()) {
    prompt += `\nNICHT verwenden: ${bv.brand_avoid}.`;
  }
  prompt += "\nAntworte immer mit validem JSON, ohne Markdown-Codeblöcke.";
  return prompt;
}

const PROMPTS: Record<string, (topic: string, context?: string) => string> = {
  carousel: (topic, ctx) => `Erstelle ein Instagram-Karussell zum Thema: "${topic}"

${ctx ? `Du hast folgende Research-Erkenntnisse — nutze sie für fundierte, spezifische Inhalte:

${ctx}

Wichtig: Baue konkrete Fakten und echte Insights ein. Kein generisches Wissen.` : ""}

Antworte mit JSON:
{
  "title": "Karussell-Titel (neugierig machend, max 8 Wörter)",
  "slides": [
    {"headline": "Slide-Titel (kurz & stark)", "points": ["Punkt 1", "Punkt 2", "Punkt 3"], "cta": "optional nur auf letzter Slide"}
  ],
  "caption": "Caption für den Post (persönlich, mit Emojis, max 150 Wörter, endet mit Frage an die Community)",
  "hashtags": ["hashtag1", "hashtag2"]
}
Erstelle 5-7 Slides. Erste Slide = Hook. Letzte Slide = CTA.`,

  pinterest: (topic, ctx) => `Erstelle einen Pinterest-Pin zum Thema: "${topic}"${ctx ? `\nKontext: ${ctx}` : ""}
Pinterest ist eine visuelle Suchmaschine — Titel und Beschreibung müssen SEO-optimiert sein.
Antworte mit JSON:
{
  "headline": "Kurzer Text-Hook fürs Bild (max 6 Wörter, neugierig machend)",
  "title": "SEO-Pin-Titel mit Keywords (max 100 Zeichen)",
  "description": "SEO-Beschreibung mit Keywords, natürlich formuliert, Call-to-Action am Ende (max 500 Zeichen)",
  "hashtags": ["tag1", "tag2", "tag3"]
}
Auf Deutsch, du-Form, warm und inspirierend.`,

  caption: (topic, ctx) => `Erstelle eine Instagram-Caption für: "${topic}"${ctx ? `\nKontext: ${ctx}` : ""}
Antworte mit JSON:
{
  "caption": "Caption mit Emojis, authentisch, ca. 80-120 Wörter",
  "hashtags": ["tag1", "tag2", "tag3"]
}
Mindestens 15 Hashtags.`,

  ideas: (topic, ctx) => `Generiere 6 Content-Ideen zum Thema: "${topic}"${ctx ? `\nKontext: ${ctx}` : ""}
Antworte mit JSON:
{
  "ideas": [
    {
      "title": "Titel der Idee",
      "type": "instagram",
      "hook": "Aufmerksamkeitsstarker Einstieg",
      "angle": "Unique Angle / Blickwinkel"
    }
  ]
}
Typen: "instagram", "blog", "newsletter". Mix aus allen drei.`,

  blog: (topic, ctx) => `Du bist die Content Creatorin selbst. Schreibe einen vollständigen, sofort veröffentlichbaren Blogartikel auf Deutsch.

Thema: "${topic}"
${ctx ? `\nRecherche-Grundlage (nutze diese Fakten):\n${ctx}` : ""}

WICHTIG: Schreibe ALLES vollständig aus — KEINE Platzhalter. Der Artikel muss direkt veröffentlicht werden können.

Antworte mit JSON:
{
  "title": "Packender, SEO-optimierter Titel (max 60 Zeichen)",
  "intro": "Persönliche, packende Einleitung (4-5 Sätze, persönliche Geschichte oder Frage)",
  "sections": [
    {
      "heading": "Abschnittstitel",
      "content": "Vollständig ausgeschriebener Inhalt (200-300 Wörter, konkret, mit Beispielen)"
    }
  ],
  "conclusion": "Persönliches Fazit mit Call-to-Action (3-4 Sätze, motivierend)",
  "metaDescription": "SEO-Meta-Description (max 155 Zeichen)",
  "readingTime": 5
}
Schreibe 4-5 inhaltlich starke Abschnitte.`,

  newsletter: (topic, ctx) => `Schreibe einen Newsletter für: "${topic}"${ctx ? `\nKontext: ${ctx}` : ""}
Antworte mit JSON:
{
  "subject": "Betreffzeile (neugierig machend, max 50 Zeichen)",
  "preheader": "Preheader-Text (max 90 Zeichen)",
  "body": "Newsletter-Text (HTML mit <p>, <ul>, <li>, <strong> Tags erlaubt, ca. 300-400 Wörter)",
  "cta": "Call-to-Action Text"
}`,

  hashtags: (topic) => `Erstelle 30 relevante Instagram-Hashtags für das Thema: "${topic}".

Verteile sie so:
- 5 Nischen-Hashtags (unter 50.000 Posts — sehr spezifisch, hohe Sichtbarkeit in der Nische)
- 15 mittlere Hashtags (50.000–500.000 Posts — guter Mix aus Reichweite und Sichtbarkeit)
- 10 breite Hashtags (über 500.000 Posts — hohe Reichweite, aber mehr Konkurrenz)

Auf Deutsch und auf Englisch mischen. Keine # Zeichen.

Antworte mit JSON:
{
  "hashtags": ["hashtag1", "hashtag2", "..."]
}
Genau 30 Hashtags.`,
};

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (ctx instanceof Response) return ctx;

  const rl = await checkRateLimit(aiLimiter, getClientIp(req));
  if (!rl.ok) {
    return tooManyRequests(rl.retryAfterSec, "Zu viele KI-Anfragen in kurzer Zeit. Bitte warte einen Moment und versuche es erneut.");
  }

  // KI-Flags (aktiviert? Monatslimit?) — generate wird von mehreren Modulen
  // geteilt, daher nur der KI-Guard, kein einzelnes Modul.
  const featureBlock = await guardFeature(ctx.tenantId, { ai: true });
  if (featureBlock) return featureBlock;
  await incrAiUsage(ctx.tenantId); // akzeptierten KI-Aufruf zählen (Monatsverbrauch)

  const body = await readJson<{ type: string; topic: string; context?: string; brandVoice?: BrandVoice; provider?: string; model?: string }>(req);
  if (!body) return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  const { type, topic, context, brandVoice } = body;
  const { provider, model } = pickModel(body);

  const promptFn = PROMPTS[type];
  if (!promptFn) {
    return Response.json({ error: "Unbekannter Typ" }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(brandVoice);
  const userPrompt   = promptFn(topic, context);

  try {
    const { text, tokens } = await chat({
      provider, model,
      system: systemPrompt, user: userPrompt,
      temperature: 0.7, maxTokens: 3000, json: true,
    });
    const result = extractJson<Record<string, unknown>>(text);
    result._tokens = tokens;
    return Response.json(result);
  } catch (e) {
    // fehlender Key → 503, sonst 500 mit deutscher Meldung
    const msg = (e as Error).message;
    const status = /nicht konfiguriert/.test(msg) ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}
