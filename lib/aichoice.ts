// ─── KI-Auswahl (Client) ─────────────────────────────────
// Volle Freiheit: ein Standard-Modell + optional pro Bereich ein anderes.
// Der Provider wird aus dem Modell abgeleitet; der Server nutzt den eigenen
// Schlüssel der Kundin (BYOK), sonst den Standard-Zugang.

import { getLS } from "@/lib/storage";
import { TEXT_MODELS } from "@/lib/llm";

export const AI_AREAS = [
  "content", "research", "trends", "repurpose", "hashtags", "newsletter", "blog", "planner",
] as const;
export type AiArea = (typeof AI_AREAS)[number];

export const AREA_LABELS: Record<AiArea, string> = {
  content: "Content (Karussell, Ideen, Pinterest)", research: "Research", trends: "Trend-Radar",
  repurpose: "Repurpose", hashtags: "Hashtags", newsletter: "Newsletter", blog: "Blog-Editor",
  planner: "Wochenplan",
};

type AiSettings = {
  ai_provider?: string; ai_model?: string;       // Legacy (eine globale Wahl)
  ai_default?: string;                            // Standard-Modell
  ai_area?: Partial<Record<AiArea, string>>;      // Overrides pro Bereich
};

function providerFor(model: string): string | undefined {
  return TEXT_MODELS.find(m => m.model === model)?.provider;
}

// Modell + Provider für einen Bereich (Override → Standard → Legacy).
export function getAiChoice(area?: AiArea): { provider?: string; model?: string } {
  const s = getLS<AiSettings>("dh_settings", {});
  const model = (area && s.ai_area?.[area]) || s.ai_default || s.ai_model;
  if (!model) return {}; // Server nimmt seinen Default
  const provider = providerFor(model) || s.ai_provider;
  return provider ? { provider, model } : { model };
}

export function getResearchEngine(): string {
  return getLS<{ research_engine?: string }>("dh_settings", {}).research_engine || "standard";
}
