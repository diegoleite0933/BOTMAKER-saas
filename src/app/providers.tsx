"use client";

import { SessionProvider } from "next-auth/react";

const fallbackAuthUrl = [
  process.env.NEXTAUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
].find((value): value is string => typeof value === "string" && value.trim().length > 0);

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider baseUrl={fallbackAuthUrl || undefined}>{children}</SessionProvider>;
}
