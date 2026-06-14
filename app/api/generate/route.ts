import { requireAuth } from "@/lib/server-auth";

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

function buildSystemPrompt(bv?: BrandVoice): string {
  const name     = bv?.name || "Desi";
  const niche    = bv?.niche || "Mind, Health, Aesthetics, Self-Improvement";
  const tone     = VOICE_LABELS[bv?.voice || ""] || bv?.voice || "warm, persönlich, ehrlich, inspirierend";
  const audience = bv?.audience || "Frauen 25–40 die an sich arbeiten möchten";
  const topics   = bv?.topics?.length ? bv.topics.join(", ") : "Mindset, Hormongesundheit, Hautpflege, Morgenroutine";

  let prompt = `Du bist Content-Assistent für ${name}, eine deutschsprachige Content Creatorin.
Ihre Nische: ${niche}.
Kernthemen: ${topics}.
Ton: ${tone}.
Zielgruppe: ${audience}.`;

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
  const authError = requireAuth(req);
  if (authError) return authError;

  const { type, topic, context, groqKey: clientKey, brandVoice } = await req.json() as {
    type: string; topic: string; context?: string;
    groqKey?: string; brandVoice?: BrandVoice;
  };
  const groqKey = clientKey || process.env.GROQ_API_KEY || "";

  if (!groqKey) {
    return Response.json({ error: "Kein Groq API Key — bitte in den Einstellungen eintragen." }, { status: 400 });
  }

  const promptFn = PROMPTS[type];
  if (!promptFn) {
    return Response.json({ error: "Unbekannter Typ" }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(brandVoice);
  const userPrompt   = promptFn(topic, context);

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
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
