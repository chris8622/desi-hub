"use client";
import { SessionProvider } from "next-auth/react";

// Stellt die Auth.js-Session dem Client-Baum bereit (useSession in LoginGate).
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
