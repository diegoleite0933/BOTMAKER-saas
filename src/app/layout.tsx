import type { Metadata } from "next";
import { Bebas_Neue, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ODISSEIA BOT | Automação de vendas para Telegram",
  description: "Crie bots, converta vendas, receba pagamentos PIX, automatize acessos e conecte gateways de pagamento em uma plataforma SaaS profissional.",
  metadataBase: new URL("https://odisseiabot.com"),
  openGraph: {
    title: "ODISSEIA BOT",
    description: "Automação de vendas para Telegram com pagamentos, acessos e recorrência.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ODISSEIA BOT",
    description: "Automação de vendas para Telegram com pagamentos e acessos automáticos.",
  },
};

import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${bebasNeue.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
