import { requireAuth } from "@/lib/server-auth";

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
  const authError = requireAuth(req);
  if (authError) return authError;

  const { settings, weekStart, groqKey } = await req.json() as {
    settings: Settings;
    weekStart: string; // "YYYY-MM-DD" of Monday
    groqKey?: string;
  };

  const apiKey = groqKey || process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: "Kein Groq API Key" }, { status: 400 });

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
  distribute(settings.freq_instagram, "Instagram", [0, 2, 4, 5, 1, 3, 6]);
  // Pinterest: über die Woche verteilt
  distribute(settings.freq_pinterest, "Pinterest", [1, 3, 5, 0, 2, 4, 6]);
  // Blog: Di oder Do
  distribute(settings.freq_blog, "Blog", [1, 3, 0, 2, 4]);
  // Newsletter: Do oder Mo
  distribute(settings.freq_newsletter, "Newsletter", [3, 0, 6, 2, 4]);

  // Thema-Vorschläge per KI generieren
  const topicsStr = settings.topics.slice(0, 6).join(", ");
  const slotsDesc = slots.map((s, i) => `${i + 1}. ${s.channel} (${s.date})`).join("\n");

  const prompt = `Du bist ein Content-Stratege für ${settings.niche}.

Erstelle konkrete Titel für diese Content-Slots der Woche:
${slotsDesc}

Themen-Pool: ${topicsStr}
Stil: ${settings.voice}

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
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "[]";

    let titles: { title: string }[] = [];
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      titles = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch { titles = []; }

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
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
