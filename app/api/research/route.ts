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

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
};

// Reddit erlaubt .json — volle Thread-Inhalte gratis
async function fetchReddit(url: string): Promise<string> {
  try {
    const jsonUrl = url.replace(/\/$/, "") + ".json";
    const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(7000), headers: BROWSER_HEADERS });
    if (!res.ok) return "";
    const data = await res.json();
    const parts: string[] = [];
    // data[0] = Post, data[1] = Kommentare
    const post = data?.[0]?.data?.children?.[0]?.data;
    if (post) {
      if (post.title) parts.push(post.title);
      if (post.selftext) parts.push(post.selftext);
    }
    const comments = data?.[1]?.data?.children || [];
    for (const c of comments.slice(0, 15)) {
      if (c?.data?.body) parts.push(c.data.body);
    }
    return parts.join("\n").slice(0, 5000);
  } catch { return ""; }
}

// Jina AI Reader — gratis, umgeht Bot-Schutz + rendert JavaScript
async function fetchViaJina(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(12000),
      headers: { "Accept": "text/plain", "X-Return-Format": "text" },
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 5000);
  } catch { return ""; }
}

// Direkter Fetch als letzter Fallback
async function fetchDirect(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), headers: BROWSER_HEADERS });
    if (!res.ok) return "";
    const html = await res.text();
    // Bot-Schutz erkennen
    if (/captcha|sgcaptcha|just a moment|cloudflare/i.test(html) && html.length < 3000) return "";
    return stripHtml(html).slice(0, 5000);
  } catch { return ""; }
}

async function fetchPageContent(url: string): Promise<string> {
  // 1. Reddit → JSON API (zuverlässig, volle Threads)
  if (/reddit\.com/i.test(url)) {
    const r = await fetchReddit(url);
    if (r.length > 100) return r;
  }

  // 2. Direkter Fetch (schnell, klappt bei ~50% der Seiten)
  const direct = await fetchDirect(url);
  if (direct.length > 400) return direct;

  // 3. Jina Reader (umgeht Bot-Schutz, etwas langsamer)
  const jina = await fetchViaJina(url);
  if (jina.length > 200) return jina;

  // 4. Was auch immer der direkte Fetch hatte
  return direct;
}

export async function POST(req: Request) {
  // Simple auth check — token is the app password stored in localStorage on login
  const appPassword = process.env.APP_PASSWORD;
  const authHeader = req.headers.get("x-app-token");
  if (appPassword && authHeader !== appPassword) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const query          = body.query as string;
  const groqKey        = (body.groqKey as string | undefined) || process.env.GROQ_API_KEY || "";
  const serperKey      = process.env.SERPER_API_KEY || "";
  const trustedDomains = (body.trustedDomains as string[] | undefined) || [];
  const searchMode     = (body.searchMode as string | undefined) || "all";
  const trustedOnly    = searchMode === "trusted_only" && trustedDomains.length > 0;

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        // ── 1. Serper: Forum + Reddit + Fact-Check Suche ─────
        send({ type: "status", data: "🔍 Suche in Foren & Quellen…" });

        const searches: { q: string; gl: string; hl: string; num: number }[] = [];

        if (trustedOnly) {
          // ── Nur bevorzugte Quellen ──────────────────────
          send({ type: "status", data: `⭐ Suche ausschließlich auf ${trustedDomains.length} bevorzugten Quellen…` });
          const chunks: string[][] = [];
          for (let i = 0; i < Math.min(trustedDomains.length, 15); i += 5)
            chunks.push(trustedDomains.slice(i, i + 5));
          for (const chunk of chunks) {
            const siteFilter = chunk.map(d => `site:${d}`).join(" OR ");
            searches.push({ q: `${query} (${siteFilter})`, gl: "at", hl: "de", num: 8 });
          }
        } else {
          // ── Generelle Suche + Wissenschaft + bevorzugte Quellen ──
          searches.push(
            { q: `${query} forum diskussion erfahrungen`, gl: "at", hl: "de", num: 8 },
            { q: `${query} site:reddit.com`,              gl: "at", hl: "de", num: 5 },
            { q: `${query} wissenschaft studie beleg wirkung`, gl: "at", hl: "de", num: 5 },
            { q: `${query} study evidence research`,      gl: "us", hl: "en", num: 5 },
            { q: `${query} site:pubmed.ncbi.nlm.nih.gov OR site:cochrane.org OR site:ncbi.nlm.nih.gov`, gl: "us", hl: "en", num: 4 },
          );
          if (trustedDomains.length > 0) {
            const chunks: string[][] = [];
            for (let i = 0; i < Math.min(trustedDomains.length, 10); i += 5)
              chunks.push(trustedDomains.slice(i, i + 5));
            for (const chunk of chunks) {
              const siteFilter = chunk.map(d => `site:${d}`).join(" OR ");
              searches.push({ q: `${query} (${siteFilter})`, gl: "at", hl: "de", num: 5 });
            }
            send({ type: "status", data: `🔍 Suche überall + gezielt auf ${trustedDomains.length} bevorzugten Quellen…` });
          }
        }

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

        // Deduplizieren + nach Glaubwürdigkeit sortieren (seriöse zuerst)
        const seen = new Set<string>();
        const credRank: Record<string, number> = { trusted: 0, medium: 1, forum: 2, unknown: 3, low: 4 };
        const sources = allResults
          .filter(r => { if (seen.has(r.link)) return false; seen.add(r.link); return true; })
          .map(r => ({ title: r.title, url: r.link, snippet: r.snippet || "", credibility: scoreDomain(r.link) }))
          .sort((a, b) => (credRank[a.credibility.level] ?? 3) - (credRank[b.credibility.level] ?? 3))
          .slice(0, 20);

        send({ type: "status", data: `📋 ${sources.length} Quellen gefunden — lese Inhalte tiefgehend…` });

        // ── 2. Seiteninhalte laden (12 parallel, seriöse Quellen priorisiert) ──
        const toFetch = sources.slice(0, 12);
        const contents = await Promise.all(toFetch.map(s => fetchPageContent(s.url)));
        const loadedCount = contents.filter(c => c.length > 200).length;

        send({ type: "status", data: `🤖 ${loadedCount}/${toFetch.length} Quellen gelesen — KI erstellt Tiefen-Analyse…` });

        // ── 3. Kontext aufbauen (mehr Inhalt pro Quelle für Tiefe) ──
        const context = toFetch
          .map((s, i) => {
            const body = (contents[i] && contents[i].length > 100) ? contents[i] : s.snippet;
            return `### ${s.title}\nQuelle: ${s.url} [${s.credibility.label}]\n${body}`;
          })
          .join("\n\n---\n\n")
          .slice(0, 32000);

        // ── 4. Groq: Zusammenfassung ────────────────────────
        const [summaryRes, factRes] = await Promise.allSettled([
          fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: `Du bist ein gründlicher Research-Analyst mit wissenschaftlichem Anspruch für eine deutschsprachige Content Creatorin (Themen: Mind, Health, Ästhetik, Selbstoptimierung). Du lieferst KEINE oberflächlichen Zusammenfassungen, sondern eine fundierte Tiefen-Analyse, die echten Mehrwert bietet und auf der die Creatorin verlässlich Content aufbauen kann. Analysiere NUR die bereitgestellten Inhalte. Antworte nur mit HTML (h3, p, ul, li, strong, em — kein anderes HTML).

ABSOLUT WICHTIG — Quellen-Ehrlichkeit & Evidenz-Einordnung:
- Erfinde NIEMALS Quellen. Zitiere nur was wörtlich in den Inhalten steht, mit echter Domain.
- Unterscheide IMMER klar zwischen:
  • <strong>Wissenschaftlich belegt</strong> (Studien, Fachquellen wie PubMed, Cochrane, Unikliniken)
  • <strong>Experten-Meinung</strong> (Ärzte, Fachredaktionen)
  • <strong>Anekdotisch / Erfahrungsberichte</strong> (Foren, Reddit, Einzelmeinungen)
- Wenn etwas umstritten ist oder Quellen sich widersprechen, sage das explizit.

Struktur (gehe in die TIEFE, sei konkret, nenne Mechanismen und Details):

1. <h3>Überblick</h3> — 3-4 Sätze: Worum geht es, warum ist es relevant?

2. <h3>Was die Wissenschaft sagt</h3> — Detaillierte Bullet-Liste. Pro Punkt: die konkrete Erkenntnis + Evidenz-Grad (z.B. "<strong>Gut belegt:</strong> …" / "<strong>Erste Hinweise:</strong> …" / "<strong>Umstritten:</strong> …") + Quelle (domain.com). Wenn Mechanismen/Wirkweisen genannt werden, erkläre sie.

3. <h3>Was Menschen in der Praxis berichten</h3> — Erfahrungen aus Foren/Communities. Was funktioniert für echte Menschen, was nicht? (mit Quelle)

4. <h3>Häufige Fragen & Missverständnisse</h3> — ul/li, was die Leute wirklich wissen wollen + verbreitete Irrtümer

5. <h3>Konkrete Aussagen</h3> — 3-5 wörtliche Zitate im Format: "Zitat" — <em>domain.com</em>. Nur echte Zitate. Sonst weglassen.

6. <h3>Content-Potenzial mit Substanz</h3> — ul/li: konkrete, fundierte Content-Ideen (Instagram/Blog/Newsletter) — KEINE Floskeln, sondern Ideen die auf den Erkenntnissen aufbauen und einen klaren Mehrwert/Hook haben.

Schreibe ausführlich und substanziell. Lieber ein präziser, tiefer Punkt als drei oberflächliche.` },
                { role: "user", content: `Research-Thema: "${query}"\n\nGefundene Inhalte (jede Quelle mit ihrer Domain — achte auf den Quellentyp in [Klammern]):\n\n${context}` },
              ],
              temperature: 0.35,
              max_tokens: 3800,
            }),
            signal: AbortSignal.timeout(40000),
          }),

          // ── 5. Groq: Faktencheck — nur wenn genug Kontext vorhanden ──
          context.length > 500
            ? fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "llama-3.3-70b-versatile",
                  messages: [
                    { role: "system", content: `Du bist ein kritischer Faktenprüfer. Antworte NUR mit gültigem JSON (kein Markdown, kein Text davor/danach):
{
  "confidence": "hoch"|"mittel"|"niedrig",
  "confidence_reason": "1 Satz Begründung auf Deutsch, du-Form",
  "source_diversity": number,
  "verified_claims": [
    { "claim": "Aussage die durch mehrere Quellen belegt ist", "sources": ["domain1.com", "domain2.at"], "source_type": "seriös"|"forum"|"gemischt" }
  ],
  "unverified_claims": [
    { "claim": "Aussage die nur auf einer Quelle basiert", "sources": ["domain1.com"], "source_type": "seriös"|"forum"|"gemischt" }
  ],
  "red_flags": ["Nur konkrete, inhaltliche Warnungen — KEIN 'Keine Quellenübersicht'"],
  "recommendation": "1-2 Sätze Empfehlung, du-Form, für Content Creatorin"
}
Wichtig: Schreibe IMMER in der du-Form (nicht Sie). Nur echte inhaltliche Red Flags angeben — keine Hinweise auf fehlende Daten.` },
                    { role: "user", content: `Thema: "${query}"\n\nQuellenübersicht:\n${sources.slice(0,8).map((s,i) => `${i+1}. ${new URL(s.url).hostname.replace("www.","")} [${s.credibility.label}]: ${s.title}`).join("\n")}\n\nInhalte:\n${context.slice(0, 14000)}` },
                  ],
                  temperature: 0.15,
                  max_tokens: 1000,
                }),
                signal: AbortSignal.timeout(40000),
              })
            : Promise.resolve(new Response(JSON.stringify({ choices: [] }), { status: 200 })),
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

        // hasContent-Flag pro Quelle ergänzen
        const sourcesWithFlag = sources.map((s, i) => ({
          ...s,
          hasContent: i < contents.length && contents[i].length > 200,
        }));

        send({ type: "result", data: { sources: sourcesWithFlag, summary, factCheck } });

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
