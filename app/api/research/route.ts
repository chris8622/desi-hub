export const maxDuration = 60;

// ─── Quellen-Glaubwürdigkeit ─────────────────────────────
const TRUSTED_DOMAINS = [
  "orf.at","derstandard.at","diepresse.com","kurier.at","apa.at",
  "spiegel.de","zeit.de","faz.net","sueddeutsche.de","tagesspiegel.de","ndr.de","ard.de","zdf.de","br.de",
  "bbc.com","reuters.com","apnews.com","theguardian.com","nature.com","science.org",
  "pubmed.ncbi.nlm.nih.gov","ncbi.nlm.nih.gov","sciencedirect.com","springer.com","cochrane.org",
  "gesundheit.gv.at","sozialministerium.at","who.int","cdc.gov","rki.de",
  "wikipedia.org","mayoclinic.org","healthline.com","webmd.com","medlineplus.gov",
  "aerzteblatt.de","medscape.com","ärztezeitung.at",
];
const MEDIUM_DOMAINS = [
  "focus.de","stern.de","t-online.de","welt.de","gmx.net","web.de",
  "netdoktor.at","netdoktor.de","onmeda.de","apotheken-umschau.de",
  "fitbook.de","brigitte.de","cosmopolitan.de","vogue.de","freundin.de",
];
const LOW_INDICATORS   = ["wordpress.com","blogspot.com","wix.com","jimdo.com","weebly.com","tumblr.com"];
const FORUM_INDICATORS = ["reddit.com","forum","gutefrage.net","quora.com","gofeminin.de","chefkoch.de","myfab5.de"];

function scoreDomain(url: string): { level: "trusted"|"medium"|"forum"|"unknown"|"low"; label: string; color: string } {
  try {
    const host = new URL(url).hostname.replace("www.","");
    if (TRUSTED_DOMAINS.some(d => host === d || host.endsWith("."+d)))
      return { level: "trusted", label: "Seriöse Quelle", color: "#6B8F71" };
    if (MEDIUM_DOMAINS.some(d => host === d || host.endsWith("."+d)))
      return { level: "medium", label: "Bekannte Quelle", color: "#B89450" };
    if (FORUM_INDICATORS.some(d => host.includes(d)))
      return { level: "forum", label: "Forum / Community", color: "#8C7B6B" };
    if (LOW_INDICATORS.some(d => host.includes(d)))
      return { level: "low", label: "Privater Blog", color: "#C0483C" };
    return { level: "unknown", label: "Unbekannte Quelle", color: "#8C7B6B" };
  } catch {
    return { level: "unknown", label: "Unbekannte Quelle", color: "#8C7B6B" };
  }
}

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
    return stripHtml(await res.text()).slice(0, 5000);
  } catch { return ""; }
}

export async function POST(req: Request) {
  const body = await req.json();
  const query    = body.query as string;
  const groqKey  = (body.groqKey as string | undefined) || process.env.GROQ_API_KEY || "";
  const serperKey = process.env.SERPER_API_KEY || "";

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        // ── 1. Serper: Forum + Reddit + Fact-Check Suche ─────
        send({ type: "status", data: "🔍 Suche in Foren & Quellen…" });

        const searches = [
          { q: `${query} forum diskussion erfahrungen`, gl: "at", hl: "de", num: 8 },
          { q: `${query} site:reddit.com`, gl: "at", hl: "de", num: 5 },
          { q: `${query} wissenschaft studie belegt`, gl: "at", hl: "de", num: 4 },
        ];

        type SR = { title: string; link: string; snippet?: string };
        const allResults: SR[] = [];
        await Promise.allSettled(searches.map(async (params) => {
          const r = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(10000),
          });
          if (r.ok) {
            const d = await r.json();
            allResults.push(...(d.organic || []));
          }
        }));

        // Deduplizieren
        const seen = new Set<string>();
        const sources = allResults
          .filter(r => { if (seen.has(r.link)) return false; seen.add(r.link); return true; })
          .slice(0, 14)
          .map(r => ({ title: r.title, url: r.link, snippet: r.snippet || "", credibility: scoreDomain(r.link) }));

        send({ type: "status", data: `📋 ${sources.length} Quellen gefunden — Inhalte laden…` });

        // ── 2. Seiteninhalte laden ──────────────────────────
        const contents = await Promise.all(sources.slice(0, 10).map(s => fetchPageContent(s.url)));

        send({ type: "status", data: "🤖 KI analysiert & prüft Fakten…" });

        // ── 3. Kontext aufbauen ─────────────────────────────
        const context = sources.slice(0, 10)
          .map((s, i) => `### ${s.title}\nQuelle: ${s.url} [${s.credibility.label}]\n${contents[i] || s.snippet}`)
          .join("\n\n---\n\n")
          .slice(0, 22000);

        // ── 4. Groq: Zusammenfassung ────────────────────────
        const [summaryRes, factRes] = await Promise.allSettled([
          fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: `Du bist ein Research-Assistent für eine deutschsprachige Content Creatorin (Themen: Mind, Health, Ästhetik, Selbstoptimierung). Analysiere die Inhalte und erstelle eine strukturierte Zusammenfassung auf Deutsch. Antworte nur mit HTML (h3, p, ul, li — kein anderes HTML).
Struktur:
1. <h3>Kurzzusammenfassung</h3> — 2-3 Sätze
2. <h3>Häufige Themen & Fragen</h3> — ul/li
3. <h3>Stimmungsbild</h3> — p
4. <h3>Interessante Aussagen</h3> — ul/li mit konkreten Zitaten
5. <h3>Content-Potenzial</h3> — ul/li mit Ideen für Instagram, Blog, Newsletter` },
                { role: "user", content: `Research-Thema: "${query}"\n\nGefundene Inhalte:\n\n${context}` },
              ],
              temperature: 0.4,
              max_tokens: 1800,
            }),
            signal: AbortSignal.timeout(40000),
          }),

          // ── 5. Groq: Faktencheck (parallel) ────────────────
          fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: `Du bist ein kritischer Faktenprüfer. Analysiere die Quellen und Inhalte zu einem Thema und antworte NUR mit diesem JSON-Format (kein Markdown, kein Text davor/danach):
{
  "confidence": "hoch"|"mittel"|"niedrig",
  "confidence_reason": "Kurze Begründung (1 Satz)",
  "source_diversity": number,
  "verified_claims": ["Claim 1 der durch mehrere Quellen bestätigt wird", ...],
  "unverified_claims": ["Claim der nur auf einer Quelle basiert", ...],
  "red_flags": ["Warnung falls vorhanden", ...],
  "recommendation": "Kurze Handlungsempfehlung für Content Creator (1-2 Sätze)"
}` },
                { role: "user", content: `Thema: "${query}"\n\nQuellenübersicht:\n${sources.map((s,i) => `${i+1}. [${s.credibility.label}] ${s.title}\n   ${s.snippet}`).join("\n\n")}\n\nInhalte:\n${context.slice(0, 15000)}` },
              ],
              temperature: 0.2,
              max_tokens: 800,
            }),
            signal: AbortSignal.timeout(40000),
          }),
        ]);

        // Ergebnisse auswerten
        let summary = !groqKey
          ? `<p style="color:var(--gold)">⚠️ <strong>Kein Groq API Key hinterlegt</strong> — bitte in den Einstellungen eintragen.</p>`
          : "<p>Zusammenfassung konnte nicht erstellt werden. Bitte versuche es erneut.</p>";

        if (summaryRes.status === "fulfilled") {
          const res = summaryRes.value;
          const d = await res.json();
          if (res.ok) {
            summary = d.choices?.[0]?.message?.content || summary;
          } else {
            // Groq-Fehler anzeigen (Statuscode + Meldung)
            const errMsg = d?.error?.message || JSON.stringify(d);
            summary = `<p style="color:var(--warm-red)">⚠️ <strong>Groq API Fehler (${res.status}):</strong> ${errMsg}</p>`;
          }
        } else {
          summary = `<p style="color:var(--warm-red)">⚠️ Verbindungsfehler zu Groq: ${summaryRes.reason}</p>`;
        }

        let factCheck = null;
        if (factRes.status === "fulfilled" && factRes.value.ok) {
          const d = await factRes.value.json();
          const raw = d.choices?.[0]?.message?.content || "{}";
          try {
            const match = raw.match(/\{[\s\S]*\}/);
            factCheck = match ? JSON.parse(match[0]) : null;
          } catch { factCheck = null; }
        }

        send({ type: "result", data: { sources, summary, factCheck } });

      } catch (err) {
        send({ type: "error", data: err instanceof Error ? err.message : "Fehler" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
