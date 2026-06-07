type TokenUsage = { date: string; tokens: number; requests: number };

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function trackTokens(tokens: number): void {
  if (typeof window === "undefined" || !tokens) return;
  try {
    const raw = localStorage.getItem("dh_token_usage");
    let usage: TokenUsage = raw ? JSON.parse(raw) : { date: today(), tokens: 0, requests: 0 };
    if (usage.date !== today()) usage = { date: today(), tokens: 0, requests: 0 }; // reset daily
    usage.tokens += tokens;
    usage.requests += 1;
    localStorage.setItem("dh_token_usage", JSON.stringify(usage));
  } catch {}
}

export function getTokenUsage(): TokenUsage {
  try {
    const raw = localStorage.getItem("dh_token_usage");
    if (!raw) return { date: today(), tokens: 0, requests: 0 };
    const u = JSON.parse(raw);
    if (u.date !== today()) return { date: today(), tokens: 0, requests: 0 };
    return u;
  } catch { return { date: today(), tokens: 0, requests: 0 }; }
}
