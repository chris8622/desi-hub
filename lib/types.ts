// ─── Zentrale Datentypen ─────────────────────────────────
// Diese Strukturen liegen in localStorage (und werden synchronisiert).
// Vorher waren PlannerItem 5× und Draft 4× lokal definiert — teils leicht
// unterschiedlich, was stille Typfehler zwischen den Modulen ermöglichte.

/** Ein Eintrag im Redaktionsplan (dh_planner). */
export type PlannerItem = {
  id: string;
  date: string;      // "YYYY-MM-DD" (lokal, nicht UTC)
  channel: string;
  title: string;
  status: string;

  // ── Post-Paket (Phase C1) ──────────────────────────────
  // Referenzen auf den tatsächlichen Inhalt. Ohne sie stand am Posttag
  // nur ein Titel im Planer — Slides, Caption und Hashtags waren verloren.
  /** Verknüpfter Blog-/Text-Entwurf (dh_drafts) */
  draftId?: string;
  /** Verknüpftes Instagram-Karussell (dh_carousels) */
  carouselId?: string;
  /** Verknüpfter Pinterest-Pin (dh_pins) */
  pinId?: string;
};

/** Ein gespeicherter Text-Entwurf (dh_drafts). */
export type Draft = {
  id: string;
  title: string;
  content: string;
  channel: string;
  savedAt: string;   // ISO
};

// ─── Content-Strukturen ──────────────────────────────────

export type Slide = { headline: string; points: string[]; cta?: string };

export type CarouselResult = {
  title: string;
  slides: Slide[];
  caption: string;
  hashtags: string[];
};

/** Gespeichertes Karussell (dh_carousels). */
export type SavedCarousel = {
  id: string;
  title: string;
  savedAt: string;
  carousel: CarouselResult;
  styles: string[];
};

/** Gespeicherter Pinterest-Pin (dh_pins). */
export type SavedPin = {
  id: string;
  headline: string;
  title: string;
  description: string;
  hashtags: string[];
  style: string;
  savedAt: string;
};

/** Eintrag der Caption-Bank (dh_caption_bank). */
export type SavedCaption = {
  id: string;
  text: string;
  hashtags: string[];
  channel: "Instagram" | "Blog" | "Newsletter" | "Pinterest" | "Sonstiges";
  notes: string;
  savedAt: string;
};

/** Hashtag-Set (dh_hashtag_sets). */
export type HashtagSet = {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  createdAt: string;
};

// ─── Handoff-Keys (Seiten-zu-Seiten-Übergabe via localStorage) ──
/** Planner/Dashboard → Content: dieses gespeicherte Karussell laden */
export const OPEN_CAROUSEL_KEY = "dh_open_carousel";
/** Planner/Dashboard → Content: diesen gespeicherten Pin laden */
export const OPEN_PIN_KEY = "dh_open_pin";
