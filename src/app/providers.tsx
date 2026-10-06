"use client";

import { SessionProvider } from "next-auth/react";

const fallbackAuthUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider baseUrl={fallbackAuthUrl || undefined}>{children}</SessionProvider>;
}
