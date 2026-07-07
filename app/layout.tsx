import type { Metadata, Viewport } from "next";
import LoginGate from "@/components/LoginGate";
import "./globals.css";

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
    <html lang="de">
      <head>
        {/* Theme vor dem ersten Paint setzen (kein Flash), gilt auch für das dunkle Theme */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=JSON.parse(localStorage.getItem('dh_settings')||'{}');if(s&&s.theme&&s.theme!=='sand'){document.documentElement.setAttribute('data-theme',s.theme);}}catch(e){}})();",
          }}
        />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      {/* LoginGate EINMAL hier statt in jeder Seite — beendet den
          syncDown + „Laden…"-Zyklus bei jedem Seitenwechsel (Audit A2) */}
      <body><LoginGate>{children}</LoginGate></body>
    </html>
  );
}
