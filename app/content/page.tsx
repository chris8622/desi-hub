"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import LoginGate from "@/components/LoginGate";

type Slide = { headline: string; points: string[]; cta?: string };
type CarouselResult = { title: string; slides: Slide[]; caption: string; hashtags: string[] };
type Idea = { title: string; type: "instagram" | "blog" | "newsletter"; hook: string; angle: string };
type IdeasResult = { ideas: Idea[] };

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

export default function ContentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"carousel" | "ideen">("carousel");

  // Carousel state
  const [carouselTopic, setCarouselTopic] = useState("");
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carousel, setCarousel] = useState<CarouselResult | null>(null);
  const [carouselError, setCarouselError] = useState("");

  // Ideas state
  const [ideaTopic, setIdeaTopic] = useState("");
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasError, setIdeasError] = useState("");

  const generateCarousel = async () => {
    if (!carouselTopic.trim()) return;
    setCarouselLoading(true);
    setCarouselError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "carousel", topic: carouselTopic }),
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ideas", topic: ideaTopic }),
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
                <button className="btn btn-primary" onClick={generateCarousel} disabled={carouselLoading || !carouselTopic.trim()}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Title + actions */}
                <div className="flex-between" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div className="section-label" style={{ marginBottom: "0.15rem" }}>Karussell</div>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{carousel.title}</h2>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn btn-secondary btn-sm" onClick={exportCarouselMd}>Als .md exportieren</button>
                    <button className="btn btn-primary btn-sm" onClick={sendToEditor}>Zum Editor →</button>
                  </div>
                </div>

                {/* Slides */}
                <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
                  {carousel.slides.map((slide, i) => (
                    <div key={i} style={{
                      minWidth: 200, maxWidth: 220,
                      background: i === 0 ? "var(--accent)" : i === carousel.slides.length - 1 ? "var(--surface2)" : "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "1.1rem",
                      flexShrink: 0,
                    }}>
                      <div style={{
                        fontSize: "0.72rem", fontWeight: 600,
                        color: i === 0 ? "rgba(255,255,255,0.7)" : "var(--muted)",
                        marginBottom: "0.4rem",
                      }}>
                        SLIDE {i + 1}
                      </div>
                      <div style={{
                        fontWeight: 700, fontSize: "0.9rem",
                        color: i === 0 ? "#fff" : "var(--text)",
                        marginBottom: "0.75rem", lineHeight: 1.3,
                      }}>
                        {slide.headline}
                      </div>
                      <ul style={{ paddingLeft: "1rem", fontSize: "0.78rem", color: i === 0 ? "rgba(255,255,255,0.85)" : "var(--muted)", lineHeight: 1.6 }}>
                        {slide.points.map((p, j) => <li key={j}>{p}</li>)}
                      </ul>
                      {slide.cta && (
                        <div style={{
                          marginTop: "0.75rem", padding: "0.4rem 0.6rem",
                          background: "rgba(255,255,255,0.2)", borderRadius: "var(--radius-sm)",
                          fontSize: "0.75rem", fontWeight: 600, color: i === 0 ? "#fff" : "var(--accent)",
                        }}>
                          {slide.cta}
                        </div>
                      )}
                    </div>
                  ))}
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
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: "auto", alignSelf: "flex-start" }}
                      onClick={() => useIdea(idea)}
                    >
                      Idee übernehmen →
                    </button>
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
