export const maxDuration = 60;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
};

interface SerperItem { title: string; link: string; snippet?: string; date?: string }

// Serper-Suche pro Region mit Zeitfilter (letzte 3 Monate)
async function regionSearch(serperKey: string, query: string, gl: string, hl: string): Promise<SerperItem[]> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl, hl, num: 8, tbs: "qdr:m3" }), // qdr:m3 = letzte 3 Monate
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return [...(data.organic || []), ...(data.topStories || [])];
  } catch { return []; }
}

// Reddit "rising"/"hot" posts zu einem Thema
async function redditHot(topic: string): Promise<SerperItem[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=hot&t=month&limit=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: BROWSER_HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.children || []).map((c: { data: { title: string; permalink: string; selftext?: string; ups: number } }) => ({
      title: c.data.title,
      link: `https://reddit.com${c.data.permalink}`,
      snippet: (c.data.selftext || "").slice(0, 200) + ` [${c.data.ups} Upvotes]`,
    }));
  } catch { return []; }
}

export async function POST(req: Request) {
  const appPassword = process.env.APP_PASSWORD;
  if (appPassword && req.headers.get("x-app-token") !== appPassword) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const niche   = (body.niche as string) || "Wellness, Gesundheit, Selbstoptimierung";
  const groqKey = (body.groqKey as string | undefined) || process.env.GROQ_API_KEY || "";
  const serperKey = process.env.SERPER_API_KEY || "";

  if (!groqKey) return new Response(JSON.stringify({ error: "Kein Groq API Key" }), { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        send({ type: "status", data: "🇺🇸 Scanne US-Trends…" });
        const usResults = await Promise.all([
          regionSearch(serperKey, `${niche} trend wellness 2026`, "us", "en"),
          regionSearch(serperKey, `viral tiktok ${niche} trend`, "us", "en"),
          redditHot(niche + " trend"),
        ]);

        send({ type: "status", data: "🇨🇳 Scanne China-Trends (Xiaohongshu, Douyin)…" });
        const cnResults = await Promise.all([
          regionSearch(serperKey, `China wellness beauty trend xiaohongshu douyin ${niche}`, "us", "en"),
          regionSearch(serperKey, `chinese health trend 2026 ${niche}`, "us", "en"),
        ]);

        send({ type: "status", data: "🇪🇺 Scanne was in Europa schon da ist…" });
        const euResults = await Promise.all([
          regionSearch(serperKey, `${niche} trend 2026`, "at", "de"),
          regionSearch(serperKey, `${niche} trend deutschland`, "de", "de"),
        ]);

        const fmt = (arr: SerperItem[][]) => arr.flat().slice(0, 14)
          .map(r => `- ${r.title}${r.snippet ? `: ${r.snippet.slice(0, 120)}` : ""}`).join("\n");

        const usText = fmt(usResults);
        const cnText = fmt(cnResults);
        const euText = fmt(euResults);

        send({ type: "status", data: "🤖 KI analysiert Trend-Vorsprung…" });

        const prompt = `Du bist ein Trend-Analyst für eine deutschsprachige Content Creatorin (Nische: ${niche}).
Analysiere folgende aktuelle Suchergebnisse aus drei Regionen und identifiziere RELEVANTE TRENDS.

=== USA (oft 6-12 Monate Vorsprung) ===
${usText}

=== CHINA (oft 12-18 Monate Vorsprung, Xiaohongshu/Douyin) ===
${cnText}

=== EUROPA / DACH (Status quo) ===
${euText}

Erstelle eine Trend-Analyse. Antworte NUR mit gültigem JSON (kein Markdown):
{
  "trends": [
    {
      "name": "Kurzer Trend-Name",
      "description": "1-2 Sätze was es ist",
      "origin": "USA"|"China"|"Europa"|"Global",
      "europe_status": "schon_da"|"kommt_bald"|"frueh_dran",
      "opportunity": "Konkrete Content-Idee für Desi (1 Satz)",
      "heat": 1-5
    }
  ],
  "early_signals": ["Trend der in USA/China sichtbar ist aber noch NICHT in Europa — das sind die Goldnuggets", "..."],
  "summary": "2-3 Sätze Gesamteinschätzung auf Deutsch, du-Form"
}

Wichtig:
- 6-8 Trends, sortiert nach Relevanz
- "frueh_dran" = in USA/China sichtbar, in Europa noch kaum → höchster Wert für Desi
- Nur echte Trends aus den Daten, nichts erfinden
- Alles auf Deutsch, du-Form`;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: 2000,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(40000),
        });

        let result: unknown = { trends: [], early_signals: [], summary: "" };
        if (res.ok) {
          const d = await res.json();
          try { result = JSON.parse(d.choices?.[0]?.message?.content || "{}"); } catch {}
        }

        // Rohquellen mitschicken
        const sources = [...usResults.flat(), ...cnResults.flat(), ...euResults.flat()]
          .filter((r, i, arr) => arr.findIndex(x => x.link === r.link) === i)
          .slice(0, 20)
          .map(r => ({ title: r.title, url: r.link }));

        send({ type: "result", data: { ...(result as object), sources } });
      } catch (err) {
        send({ type: "error", data: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
