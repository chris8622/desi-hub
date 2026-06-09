import { requireAuth } from "@/lib/server-auth";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Du bist ein Content-Assistent für Desi, eine deutschsprachige Content Creatorin.
Ihre Themen: Mind, Health, Aesthetics, Self-Improvement.
Ton: warm, persönlich, ehrlich, inspirierend — nie zu formal, nie zu lässig.
Antworte immer mit validem JSON, ohne Markdown-Codeblöcke.`;

const PROMPTS: Record<string, (topic: string, context?: string) => string> = {
  carousel: (topic, ctx) => `Erstelle ein Instagram-Karussell zum Thema: "${topic}"

${ctx ? `Du hast folgende Research-Erkenntnisse zur Verfügung — nutze sie um das Karussell inhaltlich fundiert und spezifisch zu machen:

${ctx}

Wichtig: Baue konkrete Fakten, Erkenntnisse und echte Insights aus der Research ein. Kein generisches Wissen.` : ""}

Antworte mit JSON:
{
  "title": "Karussell-Titel (neugierig machend, max 8 Wörter)",
  "slides": [
    {"headline": "Slide-Titel (kurz & stark)", "points": ["Konkreter Punkt 1", "Konkreter Punkt 2", "Konkreter Punkt 3"], "cta": "optional nur auf letzter Slide"}
  ],
  "caption": "Caption für den Post (persönlich, mit Emojis, max 150 Wörter, endet mit Frage an die Community)",
  "hashtags": ["hashtag1", "hashtag2"]
}
Erstelle 5-7 Slides. Erste Slide = Hook. Letzte Slide = CTA.`,

  pinterest: (topic, ctx) => `Erstelle einen Pinterest-Pin zum Thema: "${topic}"${ctx ? `\nKontext: ${ctx}` : ""}
Pinterest ist eine visuelle Suchmaschine — der Titel und die Beschreibung müssen SEO-optimiert mit Keywords sein.
Antworte mit JSON:
{
  "headline": "Kurzer, starker Text-Hook fürs Bild (max 6 Wörter, neugierig machend)",
  "title": "SEO-Pin-Titel mit Keywords (max 100 Zeichen)",
  "description": "SEO-Beschreibung mit relevanten Keywords, natürlich formuliert, Call-to-Action am Ende (max 500 Zeichen)",
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

  ideas: (topic, ctx) => `Generiere 6 Content-Ideen für Desi zum Thema: "${topic}"${ctx ? `\nKontext: ${ctx}` : ""}
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

  blog: (topic, ctx) => `Du bist Desi, eine authentische Content Creatorin (Mind, Health, Ästhetik, Selbstoptimierung). Schreibe einen vollständigen, sofort veröffentlichbaren Blogartikel auf Deutsch.

Thema: "${topic}"
${ctx ? `\nRecherche-Grundlage (nutze diese Fakten und Erkenntnisse):\n${ctx}` : ""}

WICHTIG: Schreibe ALLES vollständig aus — KEINE Platzhalter wie [hier einfügen] oder [schreib hier]. Der Artikel muss direkt kopiert und veröffentlicht werden können.

Ton: persönlich, warm, kompetent — wie eine gute Freundin die Expertin ist. Nutze "du". Erste Person ("Ich habe...").

Antworte mit JSON:
{
  "title": "Packender, SEO-optimierter Titel (max 60 Zeichen)",
  "intro": "Persönliche, packende Einleitung die sofort anspricht (4-5 Sätze, persönliche Geschichte oder Frage)",
  "sections": [
    {
      "heading": "Abschnittstitel",
      "content": "Vollständig ausgeschriebener Abschnittsinhalt (200-300 Wörter, konkret, mit Beispielen oder Tipps)"
    }
  ],
  "conclusion": "Persönliches Fazit mit Call-to-Action (3-4 Sätze, motivierend)",
  "metaDescription": "SEO-Meta-Description (max 155 Zeichen)",
  "readingTime": "Geschätzte Lesezeit in Minuten (Zahl)"
}
Schreibe 4-5 inhaltlich starke Abschnitte. Jeder Abschnitt vollständig ausformuliert.`,

  newsletter: (topic, ctx) => `Schreibe einen Newsletter für: "${topic}"${ctx ? `\nKontext: ${ctx}` : ""}
Antworte mit JSON:
{
  "subject": "Betreffzeile (neugierig machend, max 50 Zeichen)",
  "preheader": "Preheader-Text (max 90 Zeichen)",
  "body": "Newsletter-Text (HTML mit <p>, <ul>, <li>, <strong> Tags erlaubt, ca. 300-400 Wörter)",
  "cta": "Call-to-Action Text"
}`,
};

export async function POST(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const { type, topic, context, groqKey: clientKey } = await req.json();
  const groqKey = clientKey || process.env.GROQ_API_KEY || "";

  if (!groqKey) {
    return Response.json({ error: "Kein Groq API Key — bitte in den Einstellungen eintragen." }, { status: 400 });
  }

  const promptFn = PROMPTS[type];
  if (!promptFn) {
    return Response.json({ error: "Unbekannter Typ" }, { status: 400 });
  }

  const userPrompt = promptFn(topic, context);

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqKey || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
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

  const data = await groqRes.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  try {
    const result = JSON.parse(content);
    result._tokens = data.usage?.total_tokens || 0;
    return Response.json(result);
  } catch {
    return Response.json({ error: "Antwort konnte nicht verarbeitet werden", raw: content }, { status: 500 });
  }
}
