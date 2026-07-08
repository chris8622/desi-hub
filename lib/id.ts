// ─── Eine ID-Funktion für die ganze App ──────────────────
// Vorher gab es vier Schemata nebeneinander — zwei davon kollisionsanfällig:
//   Date.now().toString(36)                → gleiche ID bei zwei Einträgen
//                                            in derselben Millisekunde
//   Math.random().toString(36).slice(2,7)  → nur ~36^5 Möglichkeiten
// crypto.randomUUID() ist in allen Zielbrowsern verfügbar (sicherer Kontext);
// der Fallback deckt exotische Umgebungen ab.
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
