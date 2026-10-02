"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", localStorage.getItem("odisseiabot-theme") === "dark");
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
