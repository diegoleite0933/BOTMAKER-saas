import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/account-security";
import { decryptPaymentCredentials, encryptPaymentCredentials } from "@/lib/payment-credentials.js";
import { mercadoPagoCallbackUrl } from "@/lib/mercadopago-marketplace.js";
import { exchangeSyncPayAccessToken } from "@/lib/syncpay.js";

const prisma = new PrismaClient();
const supportedProviders = new Set(["mercadopago", "syncpay"]);

function normalizeProvider(provider: string | null | undefined) {
  if (provider === "syncpay") return "syncpay";
  return "mercadopago";
}

async function isAuthorizedPlatformAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isBanned?: boolean } | undefined;
  return Boolean(user?.id && !user.isBanned && isAdminEmail(session?.user?.email));
}

export async function GET(request: Request) {
  if (!(await isAuthorizedPlatformAdmin())) return NextResponse.json({ message: "Não autorizado." }, { status: 403 });

  const provider = normalizeProvider(new URL(request.url).searchParams.get("provider"));
  const account = await prisma.platformReceivingAccount.findUnique({
    where: { provider },
    select: { encryptedCredentials: true, status: true, lastValidatedAt: true, updatedAt: true },
  });
  let configured = false;
  if (account?.encryptedCredentials) {
    try {
      const credentials = decryptPaymentCredentials(account.encryptedCredentials);
      configured = Boolean(credentials.clientId && credentials.clientSecret);
    } catch {
      configured = false;
    }
  }

  const isSyncPay = provider === "syncpay";

  return NextResponse.json({
    provider,
    configured,
    status: configured ? account?.status || "CREDENTIALS_SAVED" : "NOT_CONFIGURED",
    lastValidatedAt: account?.lastValidatedAt || null,
    updatedAt: account?.updatedAt || null,
    redirectUri: isSyncPay ? null : mercadoPagoCallbackUrl(),
    splitStatus: isSyncPay
      ? "Configuração manual via Client ID e Client Secret da SyncPay; o split automatizado depende da API e do fluxo do gateway configurado."
      : "O Split 1:1 também exige que cada tenant autorize o Marketplace via OAuth.",
  });
}

export async function PUT(request: Request) {
  if (!(await isAuthorizedPlatformAdmin())) return NextResponse.json({ message: "Não autorizado." }, { status: 403 });

  const body = await request.json();
  const provider = normalizeProvider(typeof body.provider === "string" ? body.provider : null);
  if (!supportedProviders.has(provider)) return NextResponse.json({ message: "Gateway da conta recebedora não suportado." }, { status: 400 });

  const previous = await prisma.platformReceivingAccount.findUnique({
    where: { provider },
    select: { encryptedCredentials: true },
  });
  let previousCredentials: Record<string, string> = {};
  if (previous?.encryptedCredentials) {
    try {
      previousCredentials = decryptPaymentCredentials(previous.encryptedCredentials);
    } catch {
      previousCredentials = {};
    }
  }
  const clientId = typeof body.clientId === "string" && body.clientId.trim() ? body.clientId.trim() : previousCredentials.clientId || "";
  const clientSecret = typeof body.clientSecret === "string" && body.clientSecret.trim() ? body.clientSecret.trim() : previousCredentials.clientSecret || "";
  const webhookSecret = typeof body.webhookSecret === "string" && body.webhookSecret.trim() ? body.webhookSecret.trim() : previousCredentials.webhookSecret || "";

  if (provider === "syncpay") {
    if (!clientId || !clientSecret || clientId.length > 2048 || clientSecret.length > 2048 || webhookSecret.length > 2048) {
      return NextResponse.json({ message: "Informe Client ID e Client Secret válidos da SyncPay." }, { status: 400 });
    }

    try {
      await exchangeSyncPayAccessToken({ clientId, clientSecret });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credenciais da SyncPay inválidas.";
      return NextResponse.json({ message: `Credenciais da SyncPay inválidas: ${message}` }, { status: 400 });
    }
  } else {
    if (!clientId || !clientSecret || clientId.length > 2048 || clientSecret.length > 2048 || webhookSecret.length > 2048) {
      return NextResponse.json({ message: "Informe Client ID e Client Secret válidos do aplicativo Marketplace." }, { status: 400 });
    }
  }

  const credentials = {
    clientId,
    clientSecret,
    webhookSecret: webhookSecret || previousCredentials.webhookSecret || "",
  };

  await prisma.platformReceivingAccount.upsert({
    where: { provider },
    create: {
      provider,
      encryptedCredentials: encryptPaymentCredentials(credentials),
      status: "CREDENTIALS_SAVED",
    },
    update: {
      encryptedCredentials: encryptPaymentCredentials(credentials),
      status: "CREDENTIALS_SAVED",
      lastValidatedAt: null,
    },
  });

  const message = provider === "syncpay"
    ? "Credenciais da conta receptora SyncPay salvas e validadas manualmente."
    : "Credenciais da conta da plataforma salvas e cifradas. O Split Marketplace ainda depende do OAuth de cada tenant.";

  return NextResponse.json({
    message,
    provider,
    configured: true,
    status: "CREDENTIALS_SAVED",
    validated: provider === "syncpay" || provider === "mercadopago",
  });
}