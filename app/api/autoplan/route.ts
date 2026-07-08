import { requireAuth, readJson } from "@/lib/server-auth";
import { aiLimiter, checkRateLimit, getClientIp, tooManyRequests } from "@/lib/ratelimit";
import { chat, extractJson, pickModel } from "@/lib/llm";
import { guardFeature, incrAiUsage } from "@/lib/flags";

export const maxDuration = 60;

type Channel = "Instagram" | "Pinterest" | "Blog" | "Newsletter";

interface Settings {
  topics: string[];
  voice: string;
  niche: string;
  freq_instagram: number;
  freq_pinterest: number;
  freq_blog: number;
  freq_newsletter: number;
}

interface PlanEntry {
  id: string;
  date: string;
  channel: Channel;
  title: string;
  status: "Geplant";
  generated: boolean;
}

export async function POST(req: Request) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const rl = await checkRateLimit(aiLimiter, getClientIp(req));
  if (!rl.ok) {
    return tooManyRequests(rl.retryAfterSec, "Zu viele KI-Anfragen in kurzer Zeit. Bitte warte einen Moment und versuche es erneut.");
  }

  const featureBlock = await guardFeature({ ai: true, module: "planner" });
  if (featureBlock) return featureBlock;
  await incrAiUsage();

  const body = await readJson<{ settings: Settings; weekStart: string; provider?: string; model?: string }>(req);
  if (!body) return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  const { settings, weekStart } = body;
  const { provider, model } = pickModel(body);

  // Frequenzen absichern: fehlt ein Wert (undefined), würde distribute()
  // sonst ALLE bevorzugten Tage belegen ("0 >= undefined" ist false).
  const freq = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(7, n)) : fallback;
  };
  const freqInstagram  = freq(settings?.freq_instagram, 0);
  const freqPinterest  = freq(settings?.freq_pinterest, 0);
  const freqBlog       = freq(settings?.freq_blog, 0);
  const freqNewsletter = freq(settings?.freq_newsletter, 0);

  // Wochentage berechnen (Mo–So) — lokale Datumsberechnung ohne Timezone-Shift
  const [y, m, d] = weekStart.split("-").map(Number);
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(y, m - 1, d + i);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  });

  // Posting-Slots verteilen
  const slots: { date: string; channel: Channel }[] = [];

  const distribute = (count: number, channel: Channel, preferredDays: number[]) => {
    let placed = 0;
    for (const dayIdx of preferredDays) {
      if (placed >= count) break;
      if (dayIdx < days.length) {
        slots.push({ date: days[dayIdx], channel });
        placed++;
      }
    }
  };

  // Instagram: Mo, Mi, Fr, Sa (bevorzugt)
  distribute(freqInstagram, "Instagram", [0, 2, 4, 5, 1, 3, 6]);
  // Pinterest: über die Woche verteilt
  distribute(freqPinterest, "Pinterest", [1, 3, 5, 0, 2, 4, 6]);
  // Blog: Di oder Do
  distribute(freqBlog, "Blog", [1, 3, 0, 2, 4]);
  // Newsletter: Do oder Mo
  distribute(freqNewsletter, "Newsletter", [3, 0, 6, 2, 4]);

  // Thema-Vorschläge per KI generieren (fehlende Angaben neutral behandeln)
  const topicsStr = Array.isArray(settings?.topics) ? settings.topics.slice(0, 6).join(", ") : "";
  const nicheStr  = (settings?.niche || "").trim();
  const voiceStr  = (settings?.voice || "").trim();
  const slotsDesc = slots.map((s, i) => `${i + 1}. ${s.channel} (${s.date})`).join("\n");

  const prompt = `Du bist ein Content-Stratege für eine:n deutschsprachige:n Content-Creator:in${nicheStr ? ` (Nische: ${nicheStr})` : ""}.

Erstelle konkrete Titel für diese Content-Slots der Woche:
${slotsDesc}
${topicsStr ? `\nThemen-Pool: ${topicsStr}` : ""}${voiceStr ? `\nStil: ${voiceStr}` : ""}

Antworte NUR mit einem JSON-Array (kein Markdown, kein Text davor/danach):
[{"title": "Konkreter Titel für Post 1"}, {"title": "..."}, ...]

Regeln:
- Auf Deutsch
- Konkret und ansprechend, kein "Post über X"
- Instagram: kurz & emotional (max 8 Wörter)
- Pinterest: SEO-freundlich mit relevanten Keywords, da Pinterest eine visuelle Suchmaschine ist (max 10 Wörter)
- Blog: informativ mit Mehrwert (max 10 Wörter)
- Newsletter: persönlich & neugierig machend (max 10 Wörter)
- Variiere die Themen über die Woche`;

  try {
    const { text } = await chat({
      provider, model, user: prompt,
      temperature: 0.8, maxTokens: 500, timeoutMs: 25000,
    });

    let titles: { title: string }[] = [];
    try { titles = extractJson<{ title: string }[]>(text); } catch { titles = []; }

    const plan: PlanEntry[] = slots.map((slot, i) => ({
      id: `auto-${Date.now()}-${i}`,
      date: slot.date,
      channel: slot.channel,
      title: titles[i]?.title ?? `${slot.channel} Post`,
      status: "Geplant",
      generated: true,
    }));

    return Response.json({ plan });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: /nicht konfiguriert/.test(msg) ? 503 : 500 });
  }
}
