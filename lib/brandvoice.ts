// ─── Brand Voice ─────────────────────────────────────────
// Eine Quelle für die Marken-/Stimm-Angaben, die an die KI-Routen gehen.
// Der Server (buildSystemPrompt) liest daraus name/niche/voice/audience/
// topics/brand_keywords/brand_avoid — fehlende Felder werden ignoriert.
// Vorher wurde die Brand Voice nur beim Karussell mitgeschickt; Ideen,
// Pinterest und Newsletter generierten ohne — die Tonalität brach (C3).

import { getLS } from "@/lib/storage";

export function getBrandVoice(): Record<string, unknown> {
  return getLS<Record<string, unknown>>("dh_settings", {});
}
