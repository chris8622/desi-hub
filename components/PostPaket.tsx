"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlannerItem } from "@/lib/types";
import { resolvePaket, formatHashtags, openTarget } from "@/lib/postpaket";

const KIND_LABEL: Record<string, string> = {
  carousel: "Karussell",
  pin: "Pinterest-Pin",
  draft: "Text-Entwurf",
};

/**
 * Zeigt den verknüpften Inhalt eines Planer-Eintrags: Caption + Hashtags
 * kopieren, Inhalt im passenden Modul öffnen. Kern des „Post-Pakets" (C1).
 */
export default function PostPaket({ item, compact = false }: { item: PlannerItem; compact?: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState<"caption" | "tags" | null>(null);
  const paket = resolvePaket(item);

  const copy = (text: string, what: "caption" | "tags") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (paket.missing) {
    return (
      <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic" }}>
        Der verknüpfte Inhalt wurde gelöscht.
      </div>
    );
  }

  if (!paket.hasContent) {
    return compact ? null : (
      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
        Kein Inhalt verknüpft — erstelle den Post im Content-Bereich und plane ihn von dort ein.
      </div>
    );
  }

  const tagString = formatHashtags(paket.hashtags);

  const open = () => {
    const route = openTarget(paket);
    if (route) router.push(route);
  };

  return (
    <div style={{
      background: "var(--surface2)", borderRadius: "var(--radius-sm)",
      padding: compact ? "0.65rem 0.8rem" : "0.85rem 1rem",
      display: "flex", flexDirection: "column", gap: "0.6rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span className="badge badge-terra">{KIND_LABEL[paket.kind || ""] || "Inhalt"}</span>
        {paket.slideCount ? (
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{paket.slideCount} Slides</span>
        ) : null}
        {paket.hashtags?.length ? (
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{paket.hashtags.length} Hashtags</span>
        ) : null}
      </div>

      {paket.caption && !compact && (
        <p style={{
          fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.5, margin: 0,
          maxHeight: "3.6em", overflow: "hidden",
        }}>
          {paket.caption}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {paket.caption && (
          <button className="btn btn-secondary btn-sm" onClick={() => copy(paket.caption!, "caption")}>
            {copied === "caption" ? "✓ Kopiert" : "📋 Text kopieren"}
          </button>
        )}
        {tagString && (
          <button className="btn btn-secondary btn-sm" onClick={() => copy(tagString, "tags")}>
            {copied === "tags" ? "✓ Kopiert" : "#️⃣ Hashtags kopieren"}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={open}>
          Öffnen →
        </button>
      </div>
    </div>
  );
}
