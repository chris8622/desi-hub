// ─── Post-Paket (Phase C1) ───────────────────────────────
// Löst die Referenzen eines Planer-Eintrags in den echten Inhalt auf.
// Vorher stand am Posttag nur ein Titel im Planer — Slides, Caption und
// Hashtags lagen unerreichbar in einem anderen Modul.
//
// Wird von Planer UND Dashboard-Cockpit genutzt (eine Quelle der Wahrheit).

import { getLS, setLS } from "@/lib/storage";
import type {
  PlannerItem, SavedCarousel, SavedPin, Draft,
} from "@/lib/types";
import { OPEN_CAROUSEL_KEY, OPEN_PIN_KEY } from "@/lib/types";

export type PostPaket = {
  /** Hat der Eintrag überhaupt verknüpften Inhalt? */
  hasContent: boolean;
  kind: "carousel" | "pin" | "draft" | null;
  /** Fertiger Caption-/Textblock zum Kopieren */
  caption?: string;
  /** Hashtags ohne führendes # */
  hashtags?: string[];
  /** Anzahl Slides (nur Karussell) */
  slideCount?: number;
  /** Referenz-ID des verknüpften Inhalts */
  refId?: string;
  /** Verknüpfter Inhalt existiert nicht mehr (gelöscht) */
  missing?: boolean;
};

export function resolvePaket(item: PlannerItem): PostPaket {
  if (item.carouselId) {
    const hit = getLS<SavedCarousel[]>("dh_carousels", []).find(c => c.id === item.carouselId);
    if (!hit) return { hasContent: false, kind: "carousel", missing: true, refId: item.carouselId };
    return {
      hasContent: true,
      kind: "carousel",
      refId: hit.id,
      caption: hit.carousel.caption,
      hashtags: hit.carousel.hashtags,
      slideCount: hit.carousel.slides.length,
    };
  }

  if (item.pinId) {
    const hit = getLS<SavedPin[]>("dh_pins", []).find(p => p.id === item.pinId);
    if (!hit) return { hasContent: false, kind: "pin", missing: true, refId: item.pinId };
    return {
      hasContent: true,
      kind: "pin",
      refId: hit.id,
      // Pinterest: Titel + SEO-Beschreibung sind der kopierbare Textblock
      caption: [hit.title, hit.description].filter(Boolean).join("\n\n"),
      hashtags: hit.hashtags,
    };
  }

  if (item.draftId) {
    const hit = getLS<Draft[]>("dh_drafts", []).find(d => d.id === item.draftId);
    if (!hit) return { hasContent: false, kind: "draft", missing: true, refId: item.draftId };
    return { hasContent: true, kind: "draft", refId: hit.id, caption: hit.content };
  }

  return { hasContent: false, kind: null };
}

/** Hashtags als kopierfertigen String („#a #b"). */
export function formatHashtags(tags: string[] = []): string {
  return tags.map(t => `#${t.replace(/^#/, "")}`).join(" ");
}

/** Ziel-Route + Handoff setzen, um den Inhalt im passenden Modul zu öffnen. */
export function openTarget(paket: PostPaket): string | null {
  if (!paket.hasContent || !paket.refId) return null;
  if (paket.kind === "carousel") { setLS(OPEN_CAROUSEL_KEY, paket.refId); return "/content"; }
  if (paket.kind === "pin")      { setLS(OPEN_PIN_KEY, paket.refId);      return "/content"; }
  if (paket.kind === "draft")    { return `/editor?draft=${paket.refId}`; }
  return null;
}
