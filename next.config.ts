import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy.
// Hinweis: script-src/style-src brauchen 'unsafe-inline', weil die App
// durchgehend Inline-Styles nutzt und Next.js Inline-Bootstrap-Scripts
// injiziert (ohne Nonce-Infrastruktur). Der eigentliche XSS-Schutz für
// KI-Ausgaben läuft über lib/sanitize.ts; diese CSP ist Defense-in-depth
// (Clickjacking, Objekt-/Base-/Form-Restriktionen, Bild-/Connect-Herkunft).
// TODO Phase 1: script-src via Nonce + Middleware verschärfen ('unsafe-inline' raus).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
