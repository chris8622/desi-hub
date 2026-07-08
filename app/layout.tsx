import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import LoginGate from "@/components/LoginGate";
import Providers from "@/components/Providers";
import "./globals.css";

// Self-hosted via next/font (kein Google-Request zur Laufzeit — schneller + DSGVO).
// Bereitgestellt als CSS-Variablen; globals.css mappt sie auf --font-sans/--font-serif.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-base",
  display: "swap",
});
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif-base",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Contentraum",
  description: "Contentraum — wo Ideen Raum finden",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <head>
        {/* Theme vor dem ersten Paint setzen (kein Flash), gilt auch für das dunkle Theme */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=JSON.parse(localStorage.getItem('dh_settings')||'{}');if(s&&s.theme&&s.theme!=='sand'){document.documentElement.setAttribute('data-theme',s.theme);}}catch(e){}})();",
          }}
        />
      </head>
      {/* LoginGate EINMAL hier statt in jeder Seite — beendet den
          syncDown + „Laden…"-Zyklus bei jedem Seitenwechsel (Audit A2) */}
      <body><Providers><LoginGate>{children}</LoginGate></Providers></body>
    </html>
  );
}
