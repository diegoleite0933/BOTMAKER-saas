import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/account-security";
import { decryptPaymentCredentials, encryptPaymentCredentials } from "@/lib/payment-credentials.js";
import { mercadoPagoCallbackUrl } from "@/lib/mercadopago-marketplace.js";

const prisma = new PrismaClient();

async function isAuthorizedPlatformAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isBanned?: boolean } | undefined;
  return Boolean(user?.id && !user.isBanned && isAdminEmail(session?.user?.email));
}

export async function GET() {
  if (!(await isAuthorizedPlatformAdmin())) return NextResponse.json({ message: "Não autorizado." }, { status: 403 });

  const account = await prisma.platformReceivingAccount.findUnique({
    where: { provider: "mercadopago" },
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

  return NextResponse.json({
    provider: "mercadopago",
    configured,
    status: configured ? account?.status || "CREDENTIALS_SAVED" : "NOT_CONFIGURED",
    lastValidatedAt: account?.lastValidatedAt || null,
    updatedAt: account?.updatedAt || null,
    redirectUri: mercadoPagoCallbackUrl(),
    splitStatus: "O Split 1:1 também exige que cada tenant autorize o Marketplace via OAuth.",
  });
}

export async function PUT(request: Request) {
  if (!(await isAuthorizedPlatformAdmin())) return NextResponse.json({ message: "Não autorizado." }, { status: 403 });

  const body = await request.json();
  if (body.provider !== "mercadopago") return NextResponse.json({ message: "Gateway da conta recebedora não suportado." }, { status: 400 });

  const previous = await prisma.platformReceivingAccount.findUnique({
    where: { provider: "mercadopago" },
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
  if (!clientId || !clientSecret || clientId.length > 2048 || clientSecret.length > 2048 || webhookSecret.length > 2048) {
    return NextResponse.json({ message: "Informe Client ID e Client Secret válidos do aplicativo Marketplace." }, { status: 400 });
  }
  const credentials = {
    clientId,
    clientSecret,
    webhookSecret: webhookSecret || previousCredentials.webhookSecret || "",
  };

  await prisma.platformReceivingAccount.upsert({
    where: { provider: "mercadopago" },
    create: {
      provider: "mercadopago",
      encryptedCredentials: encryptPaymentCredentials(credentials),
      status: "CREDENTIALS_SAVED",
    },
    update: {
      encryptedCredentials: encryptPaymentCredentials(credentials),
      status: "CREDENTIALS_SAVED",
      lastValidatedAt: null,
    },
  });

  return NextResponse.json({ message: "Credenciais da conta da plataforma salvas e cifradas. O Split Marketplace ainda depende do OAuth de cada tenant." });
}