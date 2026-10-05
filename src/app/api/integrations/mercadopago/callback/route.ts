import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { exchangeMarketplaceAuthorizationCode } from "@/lib/mercadopago-marketplace.js";

const prisma = new PrismaClient();
const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (providerError || !code || !state) {
    return NextResponse.redirect(new URL("/dashboard/integrations?mercadopago=authorization_failed", appUrl));
  }

  try {
    await exchangeMarketplaceAuthorizationCode(prisma, { code, state });
    return NextResponse.redirect(new URL("/dashboard/integrations?mercadopago=connected", appUrl));
  } catch (error) {
    console.error("Mercado Pago marketplace OAuth failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.redirect(new URL("/dashboard/integrations?mercadopago=authorization_failed", appUrl));
  }
}
