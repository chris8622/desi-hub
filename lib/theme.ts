// ─── Theme-System ────────────────────────────────────────
// Personalisierbare Farbwelten. Die eigentlichen Werte liegen als
// CSS-Variablen in app/globals.css unter :root[data-theme="..."].
// Umgeschaltet wird nur das data-theme-Attribut am <html> — kein Flash
// (das Inline-Script in layout.tsx setzt es schon vor dem ersten Paint),
// und später (SaaS Phase 3) setzt der Tenant-Theme dieselbe Schnittstelle.

export type ThemeKey = "sand" | "terrakotta" | "salbei" | "rose" | "ozean" | "nacht";

export const THEMES: { key: ThemeKey; label: string; bg: string; accent: string; dark?: boolean }[] = [
  { key: "sand",       label: "Sand",       bg: "#F7F3EE", accent: "#C4704A" },
  { key: "terrakotta", label: "Terrakotta", bg: "#F6EFE7", accent: "#C0552F" },
  { key: "salbei",     label: "Salbei",     bg: "#F0F3ED", accent: "#5E8466" },
  { key: "rose",       label: "Rosé",       bg: "#F9F0EF", accent: "#B56576" },
  { key: "ozean",      label: "Ozean",      bg: "#EDF2F3", accent: "#3D7A87" },
  { key: "nacht",      label: "Nacht",      bg: "#1A1613", accent: "#D8875F", dark: true },
];

export function applyTheme(key: string): void {
  if (typeof document === "undefined") return;
  if (!key || key === "sand") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", key);
  }
}
