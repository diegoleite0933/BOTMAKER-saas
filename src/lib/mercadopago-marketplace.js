const { createHash, createHmac, randomBytes, timingSafeEqual } = require("node:crypto");
const { decryptPaymentCredentials, encryptPaymentCredentials } = require("./payment-credentials.js");

const MP_AUTHORIZATION_URL = "https://auth.mercadopago.com.br/authorization";
const MP_OAUTH_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

function hashOAuthState(state) {
  return createHash("sha256").update(state).digest("hex");
}

function mercadoPagoCallbackUrl() {
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return new URL("/api/integrations/mercadopago/callback", baseUrl).toString();
}

async function getMarketplaceApplication(prisma) {
  const account = await prisma.platformReceivingAccount.findUnique({
    where: { provider: "mercadopago" },
    select: { encryptedCredentials: true, status: true },
  });
  if (!account?.encryptedCredentials) return null;
  try {
    const credentials = decryptPaymentCredentials(account.encryptedCredentials);
    if (!credentials.clientId || !credentials.clientSecret) return null;
    return { ...credentials, status: account.status };
  } catch {
    return null;
  }
}

async function createMarketplaceAuthorizationUrl(prisma, { userId, workspaceId, now = new Date() }) {
  const application = await getMarketplaceApplication(prisma);
  if (!application) throw new Error("A conta Marketplace do Mercado Pago ainda não foi configurada pela plataforma.");

  const state = randomBytes(32).toString("base64url");
  await prisma.oAuthState.create({
    data: {
      stateHash: hashOAuthState(state),
      provider: "mercadopago_marketplace",
      userId,
      workspaceId,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    },
  });

  const authorizationUrl = new URL(MP_AUTHORIZATION_URL);
  authorizationUrl.searchParams.set("client_id", application.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("platform_id", "mp");
  authorizationUrl.searchParams.set("redirect_uri", mercadoPagoCallbackUrl());
  authorizationUrl.searchParams.set("state", state);
  return authorizationUrl.toString();
}

async function exchangeMarketplaceAuthorizationCode(prisma, { code, state, fetchImpl = fetch, now = new Date() }) {
  if (typeof code !== "string" || !code || typeof state !== "string" || !state) {
    throw new Error("Autorização Mercado Pago incompleta.");
  }

  const stateHash = hashOAuthState(state);
  const oauthState = await prisma.oAuthState.findUnique({ where: { stateHash } });
  if (!oauthState || oauthState.provider !== "mercadopago_marketplace" || oauthState.consumedAt || oauthState.expiresAt <= now) {
    throw new Error("Estado OAuth inválido, expirado ou já utilizado.");
  }

  const application = await getMarketplaceApplication(prisma);
  if (!application) throw new Error("Credenciais Marketplace do Mercado Pago não configuradas.");

  const body = new URLSearchParams({
    client_id: application.clientId,
    client_secret: application.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: mercadoPagoCallbackUrl(),
    state,
  });
  const response = await fetchImpl(MP_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token || !result.refresh_token || !result.user_id) {
    throw new Error("O Mercado Pago não concluiu a autorização Marketplace.");
  }

  const credentials = {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    publicKey: result.public_key || null,
    collectorId: String(result.user_id),
    marketplaceOAuth: true,
    expiresAt: new Date(now.getTime() + Number(result.expires_in || 15552000) * 1000).toISOString(),
  };

  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.oAuthState.updateMany({
      where: { id: oauthState.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (!consumed.count) throw new Error("Estado OAuth já consumido.");
    await transaction.paymentIntegration.upsert({
      where: { userId_provider: { userId: oauthState.userId, provider: "mercadopago" } },
      create: {
        userId: oauthState.userId,
        provider: "mercadopago",
        encryptedCredentials: encryptPaymentCredentials(credentials),
        lastTestAt: now,
        lastTestStatus: "success",
      },
      update: {
        encryptedCredentials: encryptPaymentCredentials(credentials),
        lastTestAt: now,
        lastTestStatus: "success",
      },
    });
  });

  return { userId: oauthState.userId, workspaceId: oauthState.workspaceId, collectorId: credentials.collectorId };
}

function verifyMercadoPagoWebhookSignature({ signature, requestId, dataId, secret }) {
  if (!signature || !requestId || !dataId || !secret) return false;
  const fields = Object.fromEntries(signature.split(",").map((field) => {
    const [key, value] = field.trim().split("=");
    return [key, value];
  }));
  if (!fields.ts || !fields.v1 || !/^[a-f0-9]{64}$/i.test(fields.v1)) return false;

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${fields.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const received = Buffer.from(fields.v1, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

module.exports = {
  MP_AUTHORIZATION_URL,
  MP_OAUTH_TOKEN_URL,
  hashOAuthState,
  mercadoPagoCallbackUrl,
  getMarketplaceApplication,
  createMarketplaceAuthorizationUrl,
  exchangeMarketplaceAuthorizationCode,
  verifyMercadoPagoWebhookSignature,
};