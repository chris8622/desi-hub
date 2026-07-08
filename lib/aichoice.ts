// ─── KI-Auswahl (Client) ─────────────────────────────────
// Liest die in den Einstellungen gewählte Text-KI + Research-Engine und
// liefert sie so, dass sie direkt in den Request-Body gespreadet werden kann.
// Keys bleiben serverseitig — hier geht nur die Auswahl über die Leitung.

import { getLS } from "@/lib/storage";

export function getAiChoice(): { provider?: string; model?: string } {
  const s = getLS<{ ai_provider?: string; ai_model?: string }>("dh_settings", {});
  const out: { provider?: string; model?: string } = {};
  if (s.ai_provider) out.provider = s.ai_provider;
  if (s.ai_model) out.model = s.ai_model;
  return out;
}

export function getResearchEngine(): string {
  return getLS<{ research_engine?: string }>("dh_settings", {}).research_engine || "standard";
}
