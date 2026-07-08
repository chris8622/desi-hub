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
  /** Verknüpfter Blog-Entwurf (dh_drafts) */
  draftId?: string;
};

/** Ein gespeicherter Text-Entwurf (dh_drafts). */
export type Draft = {
  id: string;
  title: string;
  content: string;
  channel: string;
  savedAt: string;   // ISO
};
