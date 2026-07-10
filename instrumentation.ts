// Next.js-Instrumentierung: lädt die passende Sentry-Server-Config je Runtime
// und leitet Request-Fehler (Server-Components, Route-Handler) an Sentry weiter.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
