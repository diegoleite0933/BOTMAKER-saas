import type { Metadata } from "next";
import { Bebas_Neue } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ODISSEIABOT | Gestão de vendas no Telegram",
  description: "Gerencie bots, vendas e campanhas do Telegram em um só lugar.",
};

import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${bebasNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
