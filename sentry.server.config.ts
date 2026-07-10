// Sentry — Server-Runtime (Node). Erfasst Fehler in API-Routen, Server-Components,
// Server-Actions. Ohne DSN inaktiv (App läuft normal weiter).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn && process.env.NODE_ENV === "production",
  // Nur Fehler melden, kein Performance-Tracing (Free-Kontingent für Fehler reservieren).
  tracesSampleRate: 0,
  // DSGVO: keine personenbezogenen Daten (IP, Cookies, Request-Bodies) automatisch senden.
  sendDefaultPii: false,
});
