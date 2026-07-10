// Sentry — Client (Browser). Erfasst JS-Fehler im Frontend. Ohne DSN inaktiv.
// Session-Replay bewusst aus (DSGVO + Kontingent). Meldung nur in Production.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn && process.env.NODE_ENV === "production",
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
});

// Navigations-Instrumentierung des App-Routers.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
