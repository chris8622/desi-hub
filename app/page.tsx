import type { Metadata } from "next";
import { auth } from "@/auth";
import Landing from "@/components/Landing";
import DashboardClient from "@/components/DashboardClient";

// „/" ist doppelt belegt: eingeloggt = Dashboard (App), ausgeloggt = öffentliche
// Landingpage. Der Auth-Check läuft serverseitig → Crawler (ohne Cookie) bekommen
// die vollständige, gerenderte Landingpage im ersten HTML (SEO/GEO).
export const metadata: Metadata = {
  title: { absolute: "Raumo – dein Content-Betriebssystem für Social Media" },
  description:
    "Raumo bündelt deinen ganzen Content-Prozess an einem Ort: Ideen sammeln, mit KI in deinem Ton erstellen, für jeden Kanal umwandeln, planen und auswerten. Für Creator & Coaches. 14 Tage kostenlos, ohne Kreditkarte.",
  keywords: [
    "Content-Tool", "Social Media Planung", "KI Content Creator", "Content-Workspace",
    "Instagram Content planen", "Content für Coaches", "Redaktionsplan Tool", "KI Texte Brand Voice",
    "Content Repurposing", "Raumo",
  ],
  alternates: { canonical: "https://www.raumo.eu" },
  openGraph: {
    type: "website",
    url: "https://www.raumo.eu",
    siteName: "Raumo",
    title: "Raumo – dein Content-Betriebssystem für Social Media",
    description:
      "Ideen, KI-Erstellung in deinem Ton, Repurposing, Planung und Auswertung – dein ganzer Content-Alltag an einem Ort. 14 Tage kostenlos.",
    locale: "de_AT",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raumo – dein Content-Betriebssystem",
    description:
      "Dein ganzer Content-Alltag an einem Ort – mit KI, die deine Marke kennt. 14 Tage kostenlos.",
  },
};

export default async function Home() {
  const session = await auth();
  if (!session) return <Landing />;
  return <DashboardClient />;
}
