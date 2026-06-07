export const maxDuration = 60;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DesiHubBot/1.0)" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const text = stripHtml(html);
    return text.slice(0, 5000);
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const { query } = await req.json();
  const serperKey = process.env.SERPER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        // 1. Search with Serper
        send({ type: "status", data: "Suche läuft…" });

        const [forumRes, redditRes] = await Promise.allSettled([
          fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": serperKey || "", "Content-Type": "application/json" },
            body: JSON.stringify({ q: `${query} forum diskussion erfahrungen`, gl: "at", hl: "de", num: 8 }),
            signal: AbortSignal.timeout(10000),
          }),
          fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": serperKey || "", "Content-Type": "application/json" },
            body: JSON.stringify({ q: `${query} site:reddit.com`, gl: "at", hl: "de", num: 5 }),
            signal: AbortSignal.timeout(10000),
          }),
        ]);

        type SerperResult = { title: string; link: string; snippet?: string };
        let organicResults: SerperResult[] = [];
        if (forumRes.status === "fulfilled" && forumRes.value.ok) {
          const data = await forumRes.value.json();
          organicResults = [...organicResults, ...(data.organic || [])];
        }
        if (redditRes.status === "fulfilled" && redditRes.value.ok) {
          const data = await redditRes.value.json();
          organicResults = [...organicResults, ...(data.organic || [])];
        }

        const sources = organicResults.slice(0, 13).map((r: SerperResult) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet || "",
        }));

        send({ type: "status", data: `${sources.length} Quellen gefunden. Seiten werden geladen…` });

        // 2. Fetch page contents
        const toFetch = sources.slice(0, 10);
        const contents = await Promise.all(toFetch.map(s => fetchPageContent(s.url)));

        send({ type: "status", data: "Inhalte analysieren mit KI…" });

        // 3. Build context
        const context = toFetch
          .map((s, i) => `### ${s.title}\nURL: ${s.url}\n${contents[i] || s.snippet}`)
          .join("\n\n---\n\n")
          .slice(0, 25000);

        // 4. Summarize with Groq
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey || ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `Du bist ein Research-Assistent für eine deutschsprachige Content Creatorin (Themen: Mind, Health, Aesthetics, Self-Improvement).
Analysiere die bereitgestellten Inhalte aus Foren und Diskussionen und erstelle eine strukturierte Zusammenfassung auf Deutsch.
Antworte ausschließlich mit HTML (h3, p, ul, li Tags — kein anderes HTML).
Struktur:
1. <h3>Kurzzusammenfassung</h3> — 2-3 Sätze
2. <h3>Häufige Themen & Fragen</h3> — als ul/li
3. <h3>Stimmungsbild</h3> — p
4. <h3>Interessante Aussagen</h3> — als ul/li mit konkreten Zitaten/Beobachtungen
5. <h3>Content-Potenzial</h3> — ul/li mit konkreten Ideen für Instagram, Blog, Newsletter`,
              },
              {
                role: "user",
                content: `Research-Thema: "${query}"\n\nGefundene Inhalte:\n\n${context}`,
              },
            ],
            temperature: 0.5,
            max_tokens: 2000,
          }),
          signal: AbortSignal.timeout(45000),
        });

        let summary = "";
        if (groqRes.ok) {
          const groqData = await groqRes.json();
          summary = groqData.choices?.[0]?.message?.content || "";
        } else {
          summary = "<p>Zusammenfassung konnte nicht erstellt werden.</p>";
        }

        send({ type: "result", data: { sources, summary } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        send({ type: "error", data: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
