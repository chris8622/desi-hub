type TokenUsage = { date: string; tokens: number; requests: number };

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function readUsage(): TokenUsage {
  try {
    const raw = localStorage.getItem("dh_token_usage");
    if (!raw) return { date: today(), tokens: 0, requests: 0 };
    const u = JSON.parse(raw) as TokenUsage;
    if (u.date !== today()) return { date: today(), tokens: 0, requests: 0 };
    return u;
  } catch { return { date: today(), tokens: 0, requests: 0 }; }
}

// Immer den Request-Zähler erhöhen; Tokens nur addieren wenn > 0
export function trackTokens(tokens: number): void {
  if (typeof window === "undefined") return;
  try {
    const usage = readUsage();
    usage.requests += 1;
    if (tokens > 0) usage.tokens += tokens;
    localStorage.setItem("dh_token_usage", JSON.stringify(usage));
  } catch {}
}

export function getTokenUsage(): TokenUsage {
  if (typeof window === "undefined") return { date: today(), tokens: 0, requests: 0 };
  return readUsage();
}
