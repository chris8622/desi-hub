// ─── LLM Provider-Layer ──────────────────────────────────
// Ein Ort für alle KI-Anbieter. Fast alle sprechen das OpenAI-kompatible
// /chat/completions-Format — deshalb genügt eine Funktion für Groq, OpenAI,
// Gemini, Perplexity und Claude (Anthropic-Kompat-Endpoint).
//
// REGEL (Phase 0): API-Keys leben NUR serverseitig (process.env). Der Client
// schickt nur die Auswahl (provider/model), nie einen Key.

export type Provider = "groq" | "openai" | "gemini" | "anthropic" | "perplexity";

type ProviderCfg = {
  label: string;
  baseUrl: string;   // ohne /chat/completions
  keyEnv: string;    // Name der Env-Variable mit dem Key
  jsonMode: boolean; // unterstützt response_format:{type:"json_object"} zuverlässig?
};

export const PROVIDERS: Record<Provider, ProviderCfg> = {
  groq:       { label: "Groq (Llama)",     baseUrl: "https://api.groq.com/openai/v1",                         keyEnv: "GROQ_API_KEY",       jsonMode: true  },
  openai:     { label: "OpenAI (GPT)",     baseUrl: "https://api.openai.com/v1",                              keyEnv: "OPENAI_API_KEY",     jsonMode: true  },
  gemini:     { label: "Google Gemini",    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyEnv: "GEMINI_API_KEY",     jsonMode: true  },
  // Anthropic OpenAI-Kompat-Endpoint (für Chat/JSON ausreichend; response_format
  // wird dort nicht garantiert → jsonMode:false, wir verlassen uns auf den Prompt).
  anthropic:  { label: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1",                            keyEnv: "ANTHROPIC_API_KEY",  jsonMode: false },
  perplexity: { label: "Perplexity Sonar", baseUrl: "https://api.perplexity.ai",                               keyEnv: "PERPLEXITY_API_KEY", jsonMode: false },
};

// Modell-Katalog für den Wähler in den Einstellungen (Text-Generierung).
// Stand Juli 2026 — Modell-IDs hier zentral pflegbar, wenn neue erscheinen.
export const TEXT_MODELS: { provider: Provider; model: string; label: string }[] = [
  { provider: "groq",      model: "llama-3.3-70b-versatile",   label: "Groq · Llama 3.3 70B — schnell & günstig" },
  { provider: "openai",    model: "gpt-4o-mini",               label: "OpenAI · GPT-4o mini — günstig" },
  { provider: "openai",    model: "gpt-4o",                    label: "OpenAI · GPT-4o — stark" },
  { provider: "gemini",    model: "gemini-2.5-flash",          label: "Gemini · 2.5 Flash — schnell & günstig" },
  { provider: "gemini",    model: "gemini-2.5-pro",            label: "Gemini · 2.5 Pro — stark" },
  { provider: "anthropic", model: "claude-haiku-4-5-20251001", label: "Claude · Haiku 4.5 — schnell" },
  { provider: "anthropic", model: "claude-sonnet-5",           label: "Claude · Sonnet 5 — top für deutschen Text" },
  { provider: "anthropic", model: "claude-opus-4-8",           label: "Claude · Opus 4.8 — beste Qualität" },
];

export const DEFAULT_TEXT = { provider: "groq" as Provider, model: "llama-3.3-70b-versatile" };

// Research kennt zwei „Engines": klassisch (Text-Modell + Web-Scraping via Serper)
// oder Perplexity (macht Web-Recherche + Zitate selbst).
export const RESEARCH_ENGINES = [
  { id: "standard",   label: "Standard — dein Text-Modell + Web-Quellen (günstig)" },
  { id: "perplexity", label: "Perplexity Sonar — live Web-Recherche mit echten Quellen" },
] as const;

// Provider/Model aus einem Request-Body sicher lesen (mit Fallback auf Default).
export function pickModel(body: { provider?: unknown; model?: unknown }): { provider: Provider; model: string } {
  const provider = (typeof body.provider === "string" && body.provider in PROVIDERS)
    ? body.provider as Provider : DEFAULT_TEXT.provider;
  const model = typeof body.model === "string" && body.model.trim()
    ? body.model.trim() : (provider === DEFAULT_TEXT.provider ? DEFAULT_TEXT.model : "");
  return { provider, model };
}

export type ChatOpts = {
  provider: Provider;
  model: string;
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;       // JSON-Antwort erwünscht
  timeoutMs?: number;
};

// Zentraler KI-Aufruf. Wirft mit deutscher Meldung bei fehlendem Key oder Fehler.
export async function chat(opts: ChatOpts): Promise<{ text: string; tokens: number }> {
  const cfg = PROVIDERS[opts.provider];
  if (!cfg) throw new Error(`Unbekannter KI-Anbieter: ${opts.provider}`);
  const key = process.env[cfg.keyEnv];
  if (!key) throw new Error(`${cfg.label} ist nicht konfiguriert (${cfg.keyEnv} fehlt auf dem Server).`);
  if (!opts.model) throw new Error(`Kein Modell für ${cfg.label} gewählt.`);

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });

  const reqBody: Record<string, unknown> = {
    model: opts.model,
    messages,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.maxTokens) reqBody.max_tokens = opts.maxTokens;
  if (opts.json && cfg.jsonMode) reqBody.response_format = { type: "json_object" };

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 50000),
  });

  if (!res.ok) {
    let msg = `${cfg.label}: Fehler ${res.status}`;
    try {
      const e = await res.json() as { error?: { message?: string } };
      if (e?.error?.message) msg = `${cfg.label}: ${e.error.message}`;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
  return { text: data.choices?.[0]?.message?.content || "", tokens: data.usage?.total_tokens || 0 };
}

// JSON robust aus KI-Text ziehen — auch wenn Markdown-Fences oder Text drumherum
// stehen (nötig, weil nicht jeder Anbieter response_format zuverlässig beachtet).
export function extractJson<T = unknown>(text: string): T {
  let t = (text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t) as T; } catch {}
  const m = t.match(/[[{][\s\S]*[\]}]/);
  if (m) return JSON.parse(m[0]) as T;
  throw new Error("Die KI-Antwort enthielt kein gültiges JSON.");
}
