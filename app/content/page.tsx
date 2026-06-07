"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import LoginGate from "@/components/LoginGate";

type Slide = { headline: string; points: string[]; cta?: string };
type CarouselResult = { title: string; slides: Slide[]; caption: string; hashtags: string[] };
type Idea = { title: string; type: "instagram" | "blog" | "newsletter"; hook: string; angle: string };

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

type SlideStyle = "natur" | "warm" | "sage";

const STYLE_OPTIONS: { key: SlideStyle; emoji: string; label: string; bg: string; text: string; accent: string }[] = [
  { key: "natur", emoji: "🌿", label: "Natur", bg: "#F7F3EE", text: "#2C2016", accent: "#C4704A" },
  { key: "warm", emoji: "🌸", label: "Warm", bg: "#C4704A", text: "#F7F3EE", accent: "#F7F3EE" },
  { key: "sage", emoji: "🌿", label: "Sage", bg: "#6B8F71", text: "#F7F3EE", accent: "#F7F3EE" },
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
  const s = STYLE_OPTIONS.find(o => o.key === style)!;
  const isNatur = style === "natur";

  return (
    <div
      ref={slideRef}
      style={{
        width: 360,
        height: 360,
        flexShrink: 0,
        background: s.bg,
        borderRadius: 12,
        padding: 28,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Top row: accent bar + slide number */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ width: 40, height: 3, background: s.accent, borderRadius: 2 }} />
        <div style={{ fontSize: 11, color: isNatur ? "#8C7B6B" : "rgba(247,243,238,0.65)", fontWeight: 500 }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 22,
          lineHeight: 1.2,
          color: s.text,
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
            <span style={{ color: s.accent, fontSize: 9, marginTop: 4, flexShrink: 0 }}>●</span>
            <span style={{ fontSize: 13, color: s.text, lineHeight: 1.55 }}>{p}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {slide.cta && (
        <div
          style={{
            marginTop: 14,
            padding: "7px 12px",
            background: isNatur ? "#C4704A" : "rgba(255,255,255,0.2)",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            color: isNatur ? "#F7F3EE" : s.text,
            alignSelf: "flex-start",
          }}
        >
          {slide.cta}
        </div>
      )}

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 18,
          fontSize: 11,
          color: isNatur ? "#8C7B6B" : "rgba(247,243,238,0.5)",
          fontWeight: 400,
        }}
      >
        @{handle}
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
  const [igHandle, setIgHandle] = useState("desi");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load Instagram handle from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dh_instagram_handle");
    if (saved) setIgHandle(saved);
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
                    {/* Style selector */}
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500, marginRight: "0.25rem" }}>Stil:</span>
                      {STYLE_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setSlideStyle(opt.key)}
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
                    {carousel.slides.map((slide, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", scrollSnapAlign: "start" }}>
                        <SlidePreview
                          slide={slide}
                          index={i}
                          total={carousel.slides.length}
                          style={slideStyle}
                          handle={igHandle || "desi"}
                          slideRef={el => { slideRefs.current[i] = el; }}
                        />
                        {/* Per-slide download */}
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ alignSelf: "center", fontSize: "0.78rem" }}
                          onClick={() => downloadSlide(i)}
                        >
                          ⬇ PNG
                        </button>
                      </div>
                    ))}
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

                  {/* Download all + error */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
                    {downloadError && (
                      <span style={{ fontSize: "0.8rem", color: "#C0392B" }}>{downloadError}</span>
                    )}
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
              <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎠</div>
                <div>Gib ein Thema ein und generiere dein Karussell</div>
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
