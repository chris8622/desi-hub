"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import LoginGate from "@/components/LoginGate";
import { scheduleSyncUp } from "@/lib/sync";

type Slide = { headline: string; points: string[]; cta?: string };
type CarouselResult = { title: string; slides: Slide[]; caption: string; hashtags: string[] };
type Idea = { title: string; type: "instagram" | "blog" | "newsletter"; hook: string; angle: string };

type SavedCarousel = {
  id: string;
  title: string;
  savedAt: string;
  carousel: CarouselResult;
  styles: string[];
};

function setLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function getLS<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

const TYPE_BADGE: Record<string, string> = {
  instagram: "badge-terra",
  blog: "badge-sage",
  newsletter: "badge-gold",
};
const TYPE_LABEL: Record<string, string> = {
  instagram: "Instagram",
  blog: "Blog",
  newsletter: "Newsletter",
};

type SlideStyle = string; // "natur" | "warm" | "sage" | "photo-p1" | ...

const STYLE_OPTIONS: { key: string; emoji: string; label: string; bg: string; text: string; accent: string }[] = [
  { key: "natur", emoji: "🌿", label: "Natur", bg: "#F7F3EE", text: "#2C2016", accent: "#C4704A" },
  { key: "warm", emoji: "🌸", label: "Warm", bg: "#C4704A", text: "#F7F3EE", accent: "#F7F3EE" },
  { key: "sage", emoji: "🌿", label: "Sage", bg: "#6B8F71", text: "#F7F3EE", accent: "#F7F3EE" },
];

// Alle Fotos: Unsplash License (kostenlos verwendbar, Attribution empfohlen)
// https://unsplash.com/license
const STOCK_PHOTOS = [
  { id: "p1",  url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=720&q=80&auto=format&fit=crop", label: "Berge",           photographer: "Samuel Ferrara",   unsplashUrl: "https://unsplash.com/photos/1SHkSqQ-p1Y" },
  { id: "p2",  url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=720&q=80&auto=format&fit=crop", label: "Yoga",             photographer: "Conscious Design", unsplashUrl: "https://unsplash.com/photos/JLj8MvvI3-8" },
  { id: "p3",  url: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=720&q=80&auto=format&fit=crop", label: "Sonnenstrahlen",  photographer: "Jeremy Bishop",    unsplashUrl: "https://unsplash.com/photos/EwKXn5CapA4" },
  { id: "p4",  url: "https://images.unsplash.com/photo-1487700160041-babef9c3cb55?w=720&q=80&auto=format&fit=crop", label: "Kaffee & Journal",photographer: "Estée Janssens",  unsplashUrl: "https://unsplash.com/photos/zni0zgb3bkQ" },
  { id: "p5",  url: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=720&q=80&auto=format&fit=crop", label: "Blüten",           photographer: "Debby Hudson",     unsplashUrl: "https://unsplash.com/photos/AsahNlC0VhQ" },
  { id: "p6",  url: "https://images.unsplash.com/photo-1483354568375-35cc4f0f2f52?w=720&q=80&auto=format&fit=crop", label: "Strand",           photographer: "Max Okhrimenko",   unsplashUrl: "https://unsplash.com/photos/UkzeEpB2lHo" },
  { id: "p7",  url: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=720&q=80&auto=format&fit=crop", label: "Hautpflege",       photographer: "Charisse Kenion",  unsplashUrl: "https://unsplash.com/photos/tWe8ib-cnXY" },
  { id: "p8",  url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=720&q=80&auto=format&fit=crop", label: "Pflanzen",         photographer: "Brina Blum",       unsplashUrl: "https://unsplash.com/photos/Bb_X4JgSqIM" },
  { id: "p9",  url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=720&q=80&auto=format&fit=crop", label: "Morgenroutine",   photographer: "Battlecreek Coffee",unsplashUrl: "https://unsplash.com/photos/q2DmChKJhCk" },
  { id: "p10", url: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=720&q=80&auto=format&fit=crop", label: "Wellness",         photographer: "alan caishan",     unsplashUrl: "https://unsplash.com/photos/v4UGHe3DamI" },
  { id: "p11", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=720&q=80&auto=format&fit=crop", label: "Natur & Ruhe",    photographer: "Sergei Akulich",   unsplashUrl: "https://unsplash.com/photos/l7fQ9CJJQCM" },
  { id: "p12", url: "https://images.unsplash.com/photo-1527515545081-5db817172677?w=720&q=80&auto=format&fit=crop", label: "Meditation",      photographer: "Le Minh Phuong",   unsplashUrl: "https://unsplash.com/photos/OtW4pEkFxKg" },
];

function SlidePreview({
  slide,
  index,
  total,
  style,
  handle,
  slideRef,
}: {
  slide: Slide;
  index: number;
  total: number;
  style: SlideStyle;
  handle: string;
  slideRef: (el: HTMLDivElement | null) => void;
}) {
  const isPhoto = style.startsWith("photo-");
  const photoEntry = isPhoto ? STOCK_PHOTOS.find(p => `photo-${p.id}` === style) : null;
  const photoUrl = photoEntry?.url ?? null;

  const solidStyle = STYLE_OPTIONS.find(o => o.key === style) ?? STYLE_OPTIONS[0];
  const isNatur = style === "natur";

  // Colors for photo mode
  const textColor = isPhoto ? "#FFFFFF" : solidStyle.text;
  const accentColor = isPhoto ? "#FFFFFF" : solidStyle.accent;
  const subColor = isPhoto ? "rgba(255,255,255,0.65)" : (isNatur ? "#8C7B6B" : "rgba(247,243,238,0.65)");

  const bgStyle: React.CSSProperties = photoUrl
    ? { backgroundImage: `url(${photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: solidStyle.bg };

  return (
    <div
      ref={slideRef}
      style={{
        width: 360,
        height: 360,
        flexShrink: 0,
        borderRadius: 12,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
        ...bgStyle,
      }}
    >
      {/* Photo overlay */}
      {photoUrl && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(44,32,22,0.45)" }} />
      )}

      {/* Content layer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          padding: 28,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top row: accent bar + slide number */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ width: 40, height: 3, background: accentColor, borderRadius: 2 }} />
          <div style={{ fontSize: 11, color: subColor, fontWeight: 500 }}>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 22,
            lineHeight: 1.2,
            color: textColor,
            fontWeight: 400,
            marginBottom: 14,
          }}
        >
          {slide.headline}
        </div>

        {/* Points */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {slide.points.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <span style={{ color: accentColor, fontSize: 9, marginTop: 4, flexShrink: 0 }}>●</span>
              <span style={{ fontSize: 13, color: textColor, lineHeight: 1.55 }}>{p}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {slide.cta && (
          <div
            style={{
              marginTop: 14,
              padding: "7px 12px",
              background: isPhoto ? "rgba(255,255,255,0.2)" : (isNatur ? "#C4704A" : "rgba(255,255,255,0.2)"),
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: isPhoto ? "#FFFFFF" : (isNatur ? "#F7F3EE" : solidStyle.text),
              alignSelf: "flex-start",
            }}
          >
            {slide.cta}
          </div>
        )}

        {/* Watermark + Photo Attribution */}
        <div style={{ position: "absolute", bottom: 14, left: 18, right: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          {/* Foto-Attribution links — nur bei Foto-Hintergrund */}
          {photoEntry ? (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>
              📷 {photoEntry.photographer}{"\n"}via Unsplash
            </div>
          ) : <div />}
          {/* Handle rechts */}
          <div style={{ fontSize: 11, color: isPhoto ? "rgba(255,255,255,0.5)" : (isNatur ? "#8C7B6B" : "rgba(247,243,238,0.5)"), fontWeight: 400 }}>
            @{handle}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"carousel" | "ideen">("carousel");
  const [researchBanner, setResearchBanner] = useState<string | null>(null);
  const [researchContext, setResearchContext] = useState<string>("");

  useEffect(() => {
    const ctx = getLS<{ query: string; summary: string; sources?: {title:string;url:string}[]; mode?: string } | null>("dh_research_context", null);
    if (ctx) {
      setLS("dh_research_context", null);
      if (ctx.mode === "carousel") {
        setCarouselTopic(ctx.query);
        setResearchBanner(ctx.query);
        setTab("carousel");
        if (ctx.summary) {
          const plain = ctx.summary.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 2000);
          const sourceList = ctx.sources?.slice(0, 5).map(s => `- ${s.title} (${s.url})`).join("\n") || "";
          setResearchContext(`Research-Erkenntnisse zum Thema "${ctx.query}":\n${plain}${sourceList ? `\n\nQuellen:\n${sourceList}` : ""}`);
        }
      } else {
        setIdeaTopic(ctx.query);
        setResearchBanner(ctx.query);
        setTab("ideen");
        if (ctx.summary) {
          const plain = ctx.summary.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 2000);
          setResearchContext(plain);
        }
      }
    }
  }, []);

  // Carousel state
  const [carouselTopic, setCarouselTopic] = useState("");
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carousel, setCarousel] = useState<CarouselResult | null>(null);
  const [carouselError, setCarouselError] = useState("");

  // Visual preview state
  const [slideStyle, setSlideStyle] = useState<SlideStyle>("natur");
  const [slideStyles, setSlideStyles] = useState<string[]>([]);
  const [igHandle, setIgHandle] = useState("desi");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Save state
  const [savedCarousels, setSavedCarousels] = useState<SavedCarousel[]>([]);
  const [savedMsg, setSavedMsg] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Per-slide photo picker state
  const [openPhotoPicker, setOpenPhotoPicker] = useState<number | null>(null);

  // Load Instagram handle and saved carousels from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dh_instagram_handle");
    if (saved) setIgHandle(saved);
    setSavedCarousels(getLS<SavedCarousel[]>("dh_carousels", []));
  }, []);

  const saveHandle = (val: string) => {
    setIgHandle(val);
    localStorage.setItem("dh_instagram_handle", val);
  };

  // Ideas state
  const [ideaTopic, setIdeaTopic] = useState("");
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasError, setIdeasError] = useState("");

  const generateCarousel = async (topicOverride?: string) => {
    const topic = topicOverride ?? carouselTopic;
    if (!topic.trim()) return;
    if (topicOverride) {
      setCarouselTopic(topicOverride);
      setTab("carousel");
    }
    setCarouselLoading(true);
    setCarouselError("");
    setCarousel(null);
    setSlideStyles([]);
    slideRefs.current = [];
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-token": localStorage.getItem("desi_auth_token") || "" },
        body: JSON.stringify({ type: "carousel", topic, context: researchContext || undefined, groqKey: getLS<{groq_key?:string}>("dh_settings",{}).groq_key || "" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCarousel(data);
      // Initialize per-slide styles
      const initialStyles = Array(data.slides?.length ?? 0).fill(slideStyle);
      setSlideStyles(initialStyles);
    } catch (e) {
      setCarouselError(e instanceof Error ? e.message : "Fehler beim Generieren");
    } finally {
      setCarouselLoading(false);
    }
  };

  const generateIdeas = async () => {
    if (!ideaTopic.trim()) return;
    setIdeasLoading(true);
    setIdeasError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-token": localStorage.getItem("desi_auth_token") || "" },
        body: JSON.stringify({ type: "ideas", topic: ideaTopic, context: researchContext || undefined, groqKey: getLS<{groq_key?:string}>("dh_settings",{}).groq_key || "" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIdeas(data.ideas || []);
    } catch (e) {
      setIdeasError(e instanceof Error ? e.message : "Fehler beim Generieren");
    } finally {
      setIdeasLoading(false);
    }
  };

  const downloadSlide = async (index: number) => {
    const el = slideRefs.current[index];
    if (!el) return;
    setDownloadError("");
    try {
      const dataUrl = await toPng(el, { width: 360, height: 360, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `desi-slide-${String(index + 1).padStart(2, "0")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      setDownloadError(`Slide ${index + 1} konnte nicht exportiert werden: ${e instanceof Error ? e.message : "Unbekannter Fehler"}`);
    }
  };

  const downloadAllSlides = async () => {
    if (!carousel) return;
    setDownloadingAll(true);
    setDownloadError("");
    for (let i = 0; i < carousel.slides.length; i++) {
      await downloadSlide(i);
      if (i < carousel.slides.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    setDownloadingAll(false);
  };

  const saveCarousel = () => {
    if (!carousel) return;
    const newEntry: SavedCarousel = {
      id: Date.now().toString(),
      title: carousel.title,
      savedAt: new Date().toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }),
      carousel,
      styles: slideStyles.length > 0 ? slideStyles : Array(carousel.slides.length).fill(slideStyle),
    };
    const existing = getLS<SavedCarousel[]>("dh_carousels", []);
    const updated = [newEntry, ...existing].slice(0, 20);
    setLS("dh_carousels", updated);
    setSavedCarousels(updated);
    scheduleSyncUp(2000);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const loadSavedCarousel = (saved: SavedCarousel) => {
    setCarousel(saved.carousel);
    setSlideStyles(saved.styles);
    if (saved.styles.length > 0) {
      setSlideStyle(saved.styles[0] as SlideStyle);
    }
    setShowSaved(false);
  };

  const deleteSavedCarousel = (id: string) => {
    const updated = savedCarousels.filter(c => c.id !== id);
    setSavedCarousels(updated);
    setLS("dh_carousels", updated);
    scheduleSyncUp(2000);
  };

  const setAllSlideStyles = (style: string) => {
    if (!carousel) return;
    setSlideStyle(style);
    setSlideStyles(Array(carousel.slides.length).fill(style));
  };

  const setOneSlideStyle = (index: number, style: string) => {
    setSlideStyles(prev => {
      const next = [...prev];
      next[index] = style;
      return next;
    });
    setOpenPhotoPicker(null);
  };

  const exportCarouselMd = () => {
    if (!carousel) return;
    const lines = [
      `# ${carousel.title}`,
      "",
      ...carousel.slides.map((s, i) => [
        `## Slide ${i + 1}: ${s.headline}`,
        ...s.points.map(p => `- ${p}`),
        s.cta ? `\n**CTA:** ${s.cta}` : "",
        "",
      ].join("\n")),
      "---",
      `**Caption:** ${carousel.caption}`,
      "",
      `**Hashtags:** ${carousel.hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" ")}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `karussell-${carouselTopic.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
  };

  const sendToEditor = () => {
    if (!carousel) return;
    const content = [
      `# ${carousel.title}`,
      "",
      ...carousel.slides.map((s, i) => [
        `## Slide ${i + 1}: ${s.headline}`,
        ...s.points.map(p => `- ${p}`),
        s.cta ? `\n**CTA:** ${s.cta}` : "",
        "",
      ].join("\n")),
      "---",
      `**Caption:** ${carousel.caption}`,
      `**Hashtags:** ${carousel.hashtags.join(" ")}`,
    ].join("\n");

    setLS("dh_current_draft", { title: carousel.title, content, channel: "Instagram" });
    router.push("/editor");
  };

  const useIdea = (idea: Idea) => {
    const content = `# ${idea.title}\n\n**Hook:** ${idea.hook}\n\n**Angle:** ${idea.angle}\n\n---\n\n`;
    const channel = idea.type === "instagram" ? "Instagram" : idea.type === "blog" ? "Blog" : "Newsletter";
    setLS("dh_current_draft", { title: idea.title, content, channel });
    router.push("/editor");
  };

  // Helper: get style color preview for saved carousel cards
  const getStylePreviewColor = (style: string): string => {
    if (style.startsWith("photo-")) return "#4A3728";
    const opt = STYLE_OPTIONS.find(o => o.key === style);
    return opt?.bg ?? "#F7F3EE";
  };

  return (
    <LoginGate>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Content erstellen 💡</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Karussells, Ideen und Captions mit KI generieren</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0" }}>
          {(["carousel", "ideen"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "0.6rem 1.25rem",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "var(--accent)" : "var(--muted)",
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: -1,
                fontSize: "0.9rem",
                transition: "color 0.15s",
              }}
            >
              {t === "carousel" ? "🎠 Karussell" : "💡 Ideen"}
            </button>
          ))}
        </div>

        {/* Research-Banner */}
        {researchBanner && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: "var(--accent-light)", border: "1px solid rgba(196,112,74,0.3)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>🔍</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", color: "var(--accent2)", fontWeight: 600 }}>
                Research übernommen: <em style={{ fontWeight: 400 }}>{researchBanner}</em>
              </div>
              {researchContext && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                  ✓ Research-Zusammenfassung wird beim Generieren mitverwendet — das Carousel basiert auf echten Erkenntnissen.
                </div>
              )}
            </div>
            <button onClick={() => { setResearchBanner(null); setResearchContext(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1.1rem", flexShrink: 0 }}>×</button>
          </div>
        )}

        {/* Carousel tab */}
        {tab === "carousel" && (
          <div>
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={carouselTopic}
                  onChange={e => setCarouselTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !carouselLoading && generateCarousel()}
                  placeholder="Thema für das Karussell… z.B. Morgenroutine für mehr Energie"
                  disabled={carouselLoading}
                />
                <button className="btn btn-primary" onClick={() => generateCarousel()} disabled={carouselLoading || !carouselTopic.trim()}>
                  {carouselLoading ? "Generiere…" : "Generieren"}
                </button>
              </div>
            </div>

            {carouselError && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{carouselError}</div>}

            {carouselLoading && (
              <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
                <div>Karussell wird erstellt…</div>
              </div>
            )}

            {carousel && !carouselLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Title + text actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div>
                    <div className="section-label" style={{ marginBottom: "0.15rem" }}>Karussell</div>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{carousel.title}</h2>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button className="btn btn-secondary btn-sm" onClick={exportCarouselMd}>Als .md exportieren</button>
                    <button className="btn btn-primary btn-sm" onClick={sendToEditor}>Zum Editor →</button>
                  </div>
                </div>

                {/* Visual Preview Section */}
                <div className="card" style={{ padding: "1.25rem" }}>
                  {/* Controls row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
                    {/* Global style selector: "Alle Slides auf…" */}
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500, marginRight: "0.25rem" }}>Alle auf:</span>
                      {STYLE_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setAllSlideStyles(opt.key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.35rem 0.75rem",
                            borderRadius: 20,
                            border: slideStyle === opt.key ? `2px solid ${opt.accent === "#F7F3EE" ? opt.bg : opt.accent}` : "2px solid var(--border)",
                            background: slideStyle === opt.key ? opt.bg : "transparent",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: slideStyle === opt.key ? 600 : 400,
                            color: slideStyle === opt.key ? (opt.text === "#F7F3EE" ? opt.bg === "#C4704A" ? "#A85A38" : "#4A6B50" : opt.text) : "var(--muted)",
                            boxShadow: slideStyle === opt.key ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                            transition: "all 0.15s",
                          }}
                        >
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Instagram handle */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>@</span>
                      <input
                        className="input"
                        value={igHandle}
                        onChange={e => saveHandle(e.target.value.replace(/^@/, ""))}
                        placeholder="dein-name"
                        style={{ width: 120, fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                      />
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Wasserzeichen</span>
                    </div>
                  </div>

                  {/* Slides horizontal scroll */}
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      overflowX: "auto",
                      paddingBottom: "0.75rem",
                      scrollSnapType: "x mandatory",
                    }}
                  >
                    {carousel.slides.map((slide, i) => {
                      const currentStyle = slideStyles[i] ?? slideStyle;
                      return (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", scrollSnapAlign: "start" }}>
                          <SlidePreview
                            slide={slide}
                            index={i}
                            total={carousel.slides.length}
                            style={currentStyle}
                            handle={igHandle || "desi"}
                            slideRef={el => { slideRefs.current[i] = el; }}
                          />

                          {/* Per-slide style row */}
                          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.3rem", flexWrap: "wrap", position: "relative" }}>
                            {STYLE_OPTIONS.map(opt => (
                              <button
                                key={opt.key}
                                onClick={() => setOneSlideStyle(i, opt.key)}
                                title={opt.label}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  border: currentStyle === opt.key ? "2px solid var(--accent)" : "2px solid var(--border)",
                                  background: opt.bg,
                                  cursor: "pointer",
                                  padding: 0,
                                  boxShadow: currentStyle === opt.key ? "0 0 0 2px rgba(196,112,74,0.25)" : "none",
                                  transition: "all 0.15s",
                                  fontSize: "0.7rem",
                                }}
                                aria-label={opt.label}
                              />
                            ))}
                            {/* Photo picker button */}
                            <button
                              onClick={() => setOpenPhotoPicker(openPhotoPicker === i ? null : i)}
                              title="Foto-Hintergrund"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                border: currentStyle.startsWith("photo-") ? "2px solid var(--accent)" : "2px solid var(--border)",
                                background: currentStyle.startsWith("photo-") ? "#4A3728" : "var(--surface)",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: "0.75rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: currentStyle.startsWith("photo-") ? "0 0 0 2px rgba(196,112,74,0.25)" : "none",
                                transition: "all 0.15s",
                              }}
                              aria-label="Foto-Hintergrund wählen"
                            >
                              📸
                            </button>

                            {/* Inline photo picker */}
                            {openPhotoPicker === i && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "calc(100% + 6px)",
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  zIndex: 100,
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 10,
                                  padding: "0.6rem",
                                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                                  display: "grid",
                                  gridTemplateColumns: "repeat(4, 60px)",
                                  gap: "0.4rem",
                                  width: "max-content",
                                }}
                              >
                                {STOCK_PHOTOS.map(photo => (
                                  <button
                                    key={photo.id}
                                    onClick={() => setOneSlideStyle(i, `photo-${photo.id}`)}
                                    title={photo.label}
                                    style={{
                                      width: 60,
                                      height: 60,
                                      borderRadius: 6,
                                      border: currentStyle === `photo-${photo.id}` ? "2px solid var(--accent)" : "2px solid transparent",
                                      backgroundImage: `url(${photo.url})`,
                                      backgroundSize: "cover",
                                      backgroundPosition: "center",
                                      cursor: "pointer",
                                      padding: 0,
                                      overflow: "hidden",
                                      position: "relative",
                                    }}
                                    aria-label={photo.label}
                                  >
                                    {/* Label + Fotograf */}
                                    <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "0.55rem", textAlign: "center", padding: "2px 2px", lineHeight: 1.2 }}>
                                      {photo.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                              {/* Lizenz-Hinweis unter der Auswahl */}
                              <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "0.4rem", lineHeight: 1.4 }}>
                                📷 Alle Fotos: <a href="https://unsplash.com/license" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>Unsplash License</a> (kostenlos, Attribution empfohlen)
                              </div>
                              {/* Aktuell gewähltes Foto mit Attribution */}
                              {(() => {
                                const currentPhoto = STOCK_PHOTOS.find(p => `photo-${p.id}` === currentStyle);
                                if (!currentPhoto) return null;
                                return (
                                  <div style={{ marginTop: "0.35rem", fontSize: "0.7rem", color: "var(--muted)" }}>
                                    Aktuell: <strong>{currentPhoto.label}</strong> · Foto von{" "}
                                    <a href={currentPhoto.unsplashUrl} target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>
                                      {currentPhoto.photographer}
                                    </a> auf Unsplash
                                  </div>
                                );
                              })()}
                              </div>
                            )}
                          </div>

                          {/* Per-slide download */}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ alignSelf: "center", fontSize: "0.78rem" }}
                            onClick={() => downloadSlide(i)}
                          >
                            ⬇ PNG
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Slide dots */}
                  <div style={{ display: "flex", justifyContent: "center", gap: "0.4rem", marginTop: "0.25rem" }}>
                    {carousel.slides.map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          opacity: 0.35 + (0.65 / Math.max(carousel.slides.length - 1, 1)) * i,
                        }}
                      />
                    ))}
                  </div>

                  {/* Download all + save + error */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
                    {downloadError && (
                      <span style={{ fontSize: "0.8rem", color: "#C0392B" }}>{downloadError}</span>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={saveCarousel}
                      style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                    >
                      {savedMsg ? "✓ Gespeichert" : "💾 Speichern"}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={downloadAllSlides}
                      disabled={downloadingAll}
                      style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                    >
                      {downloadingAll ? "Lade herunter…" : "⬇ Alle herunterladen"}
                    </button>
                  </div>
                </div>

                {/* Gespeicherte Carousels */}
                <div className="card" style={{ padding: "1.25rem" }}>
                  <button
                    onClick={() => setShowSaved(v => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      color: "var(--text)",
                      padding: 0,
                      width: "100%",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>💾 Gespeicherte Carousels ({savedCarousels.length})</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 400 }}>{showSaved ? "▲ Einklappen" : "▼ Anzeigen"}</span>
                  </button>

                  {showSaved && (
                    <div style={{ marginTop: "1rem" }}>
                      {savedCarousels.length === 0 ? (
                        <div style={{ fontSize: "0.85rem", color: "var(--muted)", textAlign: "center", padding: "1rem 0" }}>
                          Noch keine Carousels gespeichert.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                          {savedCarousels.map(saved => (
                            <div
                              key={saved.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                padding: "0.65rem 0.85rem",
                                background: "var(--surface)",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {/* Style color preview of slide 1 */}
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 6,
                                  background: getStylePreviewColor(saved.styles[0] ?? "natur"),
                                  flexShrink: 0,
                                  border: "1px solid var(--border)",
                                }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {saved.title}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                  {saved.savedAt} · {saved.carousel.slides.length} Slides
                                </div>
                              </div>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => loadSavedCarousel(saved)}
                                style={{ flexShrink: 0 }}
                              >
                                Laden
                              </button>
                              <button
                                onClick={() => deleteSavedCarousel(saved.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--muted)",
                                  fontSize: "1rem",
                                  flexShrink: 0,
                                  padding: "0 0.25rem",
                                }}
                                title="Löschen"
                                aria-label="Carousel löschen"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Caption & Hashtags */}
                <div className="card" style={{ padding: "1.25rem" }}>
                  <div className="section-label" style={{ marginBottom: "0.5rem" }}>Caption & Hashtags</div>
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "0.85rem", whiteSpace: "pre-wrap" }}>
                    {carousel.caption}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {carousel.hashtags.map((h, i) => (
                      <span key={i} className="badge badge-terra" style={{ fontSize: "0.75rem" }}>
                        #{h.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!carousel && !carouselLoading && !carouselError && (
              <div>
                <div className="empty-state">
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎠</div>
                  <div>Gib ein Thema ein und generiere dein Karussell</div>
                </div>

                {/* Gespeicherte Carousels auch ohne aktives Carousel zeigen */}
                {savedCarousels.length > 0 && (
                  <div className="card" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
                    <button
                      onClick={() => setShowSaved(v => !v)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "var(--text)",
                        padding: 0,
                        width: "100%",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>💾 Gespeicherte Carousels ({savedCarousels.length})</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 400 }}>{showSaved ? "▲ Einklappen" : "▼ Anzeigen"}</span>
                    </button>

                    {showSaved && (
                      <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {savedCarousels.map(saved => (
                          <div
                            key={saved.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                              padding: "0.65rem 0.85rem",
                              background: "var(--surface)",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                background: getStylePreviewColor(saved.styles[0] ?? "natur"),
                                flexShrink: 0,
                                border: "1px solid var(--border)",
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {saved.title}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                {saved.savedAt} · {saved.carousel.slides.length} Slides
                              </div>
                            </div>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => loadSavedCarousel(saved)}
                              style={{ flexShrink: 0 }}
                            >
                              Laden
                            </button>
                            <button
                              onClick={() => deleteSavedCarousel(saved.id)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--muted)",
                                fontSize: "1rem",
                                flexShrink: 0,
                                padding: "0 0.25rem",
                              }}
                              title="Löschen"
                              aria-label="Carousel löschen"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Ideen tab */}
        {tab === "ideen" && (
          <div>
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={ideaTopic}
                  onChange={e => setIdeaTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !ideasLoading && generateIdeas()}
                  placeholder="Thema für Ideen… z.B. Selbstliebe"
                  disabled={ideasLoading}
                />
                <button className="btn btn-primary" onClick={generateIdeas} disabled={ideasLoading || !ideaTopic.trim()}>
                  {ideasLoading ? "Generiere…" : "Ideen generieren"}
                </button>
              </div>
            </div>

            {ideasError && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{ideasError}</div>}

            {ideasLoading && (
              <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💭</div>
                <div>Ideen werden generiert…</div>
              </div>
            )}

            {ideas.length > 0 && !ideasLoading && (
              <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                {ideas.map((idea, i) => (
                  <div key={i} className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", lineHeight: 1.35 }}>{idea.title}</div>
                      <span className={`badge ${TYPE_BADGE[idea.type]}`} style={{ flexShrink: 0, fontSize: "0.72rem" }}>
                        {TYPE_LABEL[idea.type]}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Hook</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text)", fontStyle: "italic" }}>{idea.hook}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Angle</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{idea.angle}</div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", flexWrap: "wrap" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ alignSelf: "flex-start" }}
                        onClick={() => useIdea(idea)}
                      >
                        Idee übernehmen →
                      </button>
                      {idea.type === "instagram" && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ alignSelf: "flex-start" }}
                          onClick={() => generateCarousel(idea.title)}
                        >
                          🎠 Als Carousel erstellen
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {ideas.length === 0 && !ideasLoading && !ideasError && (
              <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💡</div>
                <div>Gib ein Thema ein und lass dir Ideen generieren</div>
              </div>
            )}
          </div>
        )}
      </div>
    </LoginGate>
  );
}
