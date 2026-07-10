// Sentry — Edge-Runtime (Middleware/Edge-Routen). Ohne DSN inaktiv.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn && process.env.NODE_ENV === "production",
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
