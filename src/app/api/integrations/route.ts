import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { decryptPaymentCredentials, encryptPaymentCredentials } from "@/lib/payment-credentials.js";

const prisma = new PrismaClient();
const providerFields = {
  mercadopago: ["accessToken"],
  amplopay: ["clientId", "clientSecret"],
  pix_direto: ["pixKey"],
} as const;
const providerIds = ["mercadopago", "amplopay", "pix_direto", "pushinpay", "atomopay", "nexuswallet", "syncpay", "stripe", "oasypay"] as const;
type ProviderId = (typeof providerIds)[number];

const providerCatalog: Record<ProviderId, { name: string; description: string; status: "available" | "coming-soon"; testable: boolean }> = {
  mercadopago: { name: "Mercado Pago", description: "PIX com cobrança e confirmação automática por webhook.", status: "available", testable: true },
  amplopay: { name: "AmploPay", description: "Cobranças PIX por API com confirmação via webhook.", status: "available", testable: false },
  pix_direto: { name: "PIX Direto", description: "QR Code e copia e cola com conferência manual de comprovante.", status: "available", testable: false },
  pushinpay: { name: "Pushin Pay", description: "Conector aguardando validação de documentação e eventos.", status: "coming-soon", testable: false },
  atomopay: { name: "Átomo Pay", description: "Conector aguardando validação de documentação e eventos.", status: "coming-soon", testable: false },
  nexuswallet: { name: "Nexus Wallet", description: "Conector aguardando validação de documentação e eventos.", status: "coming-soon", testable: false },
  syncpay: { name: "Sync Pay", description: "Conector aguardando validação de documentação e eventos.", status: "coming-soon", testable: false },
  stripe: { name: "Stripe", description: "A API oficial existe; checkout, PIX e webhooks ainda não foram ligados ao sistema.", status: "coming-soon", testable: false },
  oasypay: { name: "Oasy Pay", description: "Conector aguardando validação de documentação e eventos.", status: "coming-soon", testable: false },
};

async function authenticatedUserId() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isBanned?: boolean } | undefined;
  return user?.id && !user.isBanned ? user.id : null;
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && providerIds.includes(value as ProviderId);
}

export async function GET() {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const [integrations, bots] = await Promise.all([
    prisma.paymentIntegration.findMany({ where: { userId }, select: { provider: true, lastTestAt: true, lastTestStatus: true } }),
    prisma.bot.findMany({
      where: { workspace: { userId } },
      select: { mpAccessToken: true, amploPayClientId: true, amploPayClientSecret: true, pixKey: true },
    }),
  ]);
  const saved = new Map(integrations.map((integration) => [integration.provider, integration]));
  const legacyCount = {
    mercadopago: bots.filter((bot) => !!bot.mpAccessToken).length,
    amplopay: bots.filter((bot) => !!bot.amploPayClientId || !!bot.amploPayClientSecret).length,
    pix_direto: bots.filter((bot) => !!bot.pixKey).length,
  };
  const environmentFallback = {
    mercadopago: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
    amplopay: !!(process.env.AMPLOPAY_CLIENT_ID && process.env.AMPLOPAY_CLIENT_SECRET),
    pix_direto: false,
  };

  return NextResponse.json({
    integrations: providerIds.map((provider) => ({
      id: provider,
      ...providerCatalog[provider],
      configured: saved.has(provider) || (provider in legacyCount && legacyCount[provider as keyof typeof legacyCount] > 0) || environmentFallback[provider as keyof typeof environmentFallback] === true,
      configuredCentrally: saved.has(provider),
      legacyBotCount: provider in legacyCount ? legacyCount[provider as keyof typeof legacyCount] : 0,
      environmentFallback: environmentFallback[provider as keyof typeof environmentFallback] === true,
      lastTestAt: saved.get(provider)?.lastTestAt || null,
      lastTestStatus: saved.get(provider)?.lastTestStatus || null,
    })),
  });
}

export async function PUT(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await request.json();
  if (!isProviderId(body.provider) || !(body.provider in providerFields)) {
    return NextResponse.json({ message: "Este gateway ainda não aceita configuração." }, { status: 400 });
  }

  const provider = body.provider as keyof typeof providerFields;
  const fields = providerFields[provider];
  const existing = await prisma.paymentIntegration.findUnique({ where: { userId_provider: { userId, provider } } });
  const credentials = existing ? decryptPaymentCredentials(existing.encryptedCredentials) : {};
  for (const field of fields) {
    const value = body.credentials?.[field];
    if (typeof value === "string" && value.trim()) {
      if (value.length > 2048) return NextResponse.json({ message: "Uma credencial excede o tamanho permitido." }, { status: 400 });
      credentials[field] = value.trim();
    }
  }
  if (fields.some((field) => !credentials[field])) {
    return NextResponse.json({ message: "Preencha todas as credenciais necessárias para este gateway." }, { status: 400 });
  }

  await prisma.paymentIntegration.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, encryptedCredentials: encryptPaymentCredentials(credentials) },
    update: { encryptedCredentials: encryptPaymentCredentials(credentials), lastTestAt: null, lastTestStatus: null },
  });
  return NextResponse.json({ message: "Integração salva e protegida." });
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await request.json();
  if (body.action !== "test" || body.provider !== "mercadopago") {
    return NextResponse.json({ message: "Teste automático disponível apenas para o Mercado Pago." }, { status: 400 });
  }

  const integration = await prisma.paymentIntegration.findUnique({ where: { userId_provider: { userId, provider: "mercadopago" } } });
  if (!integration) return NextResponse.json({ message: "Salve o Access Token antes de testar." }, { status: 400 });

  try {
    const credentials = decryptPaymentCredentials(integration.encryptedCredentials);
    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
      signal: AbortSignal.timeout(12000),
    });
    const testedAt = new Date();
    await prisma.paymentIntegration.update({
      where: { id: integration.id },
      data: { lastTestAt: testedAt, lastTestStatus: response.ok ? "success" : "failed" },
    });
    return NextResponse.json(
      { connected: response.ok, message: response.ok ? "Credenciais válidas no Mercado Pago." : "O Mercado Pago recusou as credenciais." },
      { status: response.ok ? 200 : 422 },
    );
  } catch {
    await prisma.paymentIntegration.update({
      where: { id: integration.id },
      data: { lastTestAt: new Date(), lastTestStatus: "failed" },
    });
    return NextResponse.json({ connected: false, message: "Não foi possível validar a conexão com o Mercado Pago." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await request.json();
  if (!isProviderId(body.provider) || !(body.provider in providerFields)) {
    return NextResponse.json({ message: "Gateway inválido." }, { status: 400 });
  }

  const provider = body.provider as keyof typeof providerFields;
  const clearLegacyFields = provider === "mercadopago"
    ? { mpAccessToken: null }
    : provider === "amplopay"
      ? { amploPayClientId: null, amploPayClientSecret: null }
      : { pixKey: null };

  await prisma.$transaction([
    prisma.paymentIntegration.deleteMany({ where: { userId, provider } }),
    prisma.bot.updateMany({ where: { workspace: { userId } }, data: clearLegacyFields }),
  ]);

  const environmentFallback = provider === "mercadopago"
    ? !!process.env.MERCADOPAGO_ACCESS_TOKEN
    : provider === "amplopay"
      ? !!(process.env.AMPLOPAY_CLIENT_ID && process.env.AMPLOPAY_CLIENT_SECRET)
      : false;
  return NextResponse.json({ message: environmentFallback ? "Credenciais da conta removidas; o fallback de ambiente continua ativo." : "Integração desconectada." });
}