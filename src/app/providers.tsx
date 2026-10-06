"use client";

import { SessionProvider } from "next-auth/react";

const fallbackAuthUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider baseUrl={fallbackAuthUrl}>{children}</SessionProvider>;
}
