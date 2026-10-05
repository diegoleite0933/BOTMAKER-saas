const { createCipheriv, createDecipheriv, createHash, randomBytes } = require("node:crypto");

function encryptionKey() {
  const secret = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Configure NEXTAUTH_SECRET para proteger as credenciais de pagamento.");
  return createHash("sha256").update(secret).digest();
}

function encryptPaymentCredentials(credentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);

  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  });
}

function decryptPaymentCredentials(payload) {
  const envelope = JSON.parse(payload);
  if (envelope.version !== 1 || !envelope.iv || !envelope.tag || !envelope.data) {
    throw new Error("Formato de credencial de pagamento inválido.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

async function resolveTenantSyncPayCredentials(prisma, workspaceId) {
  if (!workspaceId || !prisma?.syncPayConnection) return null;

  const connection = await prisma.syncPayConnection.findFirst({
    where: { workspaceId },
    select: { clientId: true, encryptedClientSecret: true, accessToken: true },
  });

  if (!connection || !connection.encryptedClientSecret) return null;

  try {
    const decrypted = decryptPaymentCredentials(connection.encryptedClientSecret);
    return {
      clientId: connection.clientId || "",
      clientSecret: decrypted.clientSecret || "",
      accessToken: connection.accessToken || "",
    };
  } catch {
    return null;
  }
}

function readEnvValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function resolvePlatformReceivingCredentials(prisma, provider) {
  if (!prisma?.platformReceivingAccount) return null;
  const account = await prisma.platformReceivingAccount.findUnique({
    where: { provider },
    select: { encryptedCredentials: true, status: true },
  });
  if (!account?.encryptedCredentials) return null;
  try {
    return { ...decryptPaymentCredentials(account.encryptedCredentials), status: account.status };
  } catch {
    return null;
  }
}

async function refreshMarketplaceAccessToken(prisma, userId, credentials) {
  if (!credentials.marketplaceOAuth || !credentials.refreshToken) return credentials;
  const expiresAt = Date.parse(credentials.expiresAt || "");
  if (!Number.isFinite(expiresAt) || expiresAt > Date.now() + 60_000) return credentials;

  const platformCredentials = await resolvePlatformReceivingCredentials(prisma, "mercadopago");
  if (!platformCredentials?.clientId || !platformCredentials?.clientSecret) {
    throw new Error("A conexão Mercado Pago Marketplace da plataforma não está configurada.");
  }

  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: platformCredentials.clientId,
      client_secret: platformCredentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token || !result.refresh_token) {
    throw new Error("Não foi possível renovar a autorização OAuth do Mercado Pago. Reconecte a conta.");
  }

  const refreshed = {
    ...credentials,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    publicKey: result.public_key || credentials.publicKey || null,
    collectorId: String(result.user_id || credentials.collectorId),
    expiresAt: new Date(Date.now() + Number(result.expires_in || 15552000) * 1000).toISOString(),
  };
  await prisma.paymentIntegration.update({
    where: { userId_provider: { userId, provider: "mercadopago" } },
    data: { encryptedCredentials: encryptPaymentCredentials(refreshed) },
  });
  return refreshed;
}

async function resolvePaymentCredentials(prisma, bot, provider) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: bot.workspaceId },
    select: { userId: true },
  });

  if (workspace) {
    const integration = await prisma.paymentIntegration.findUnique({
      where: { userId_provider: { userId: workspace.userId, provider } },
      select: { encryptedCredentials: true },
    });
    if (integration) {
      const credentials = decryptPaymentCredentials(integration.encryptedCredentials);
      return provider === "mercadopago"
        ? refreshMarketplaceAccessToken(prisma, workspace.userId, credentials)
        : credentials;
    }
  }

  if (provider === "mercadopago") return { accessToken: bot.mpAccessToken || readEnvValue("MERCADOPAGO_ACCESS_TOKEN") || "" };
  if (provider === "amplopay") {
    return {
      clientId: bot.amploPayClientId || readEnvValue("AMPLOPAY_CLIENT_ID") || "",
      clientSecret: bot.amploPayClientSecret || readEnvValue("AMPLOPAY_CLIENT_SECRET") || "",
    };
  }
  if (provider === "pix_direto") return { pixKey: bot.pixKey || "" };
  if (provider === "syncpay") {
    const scoped = await resolveTenantSyncPayCredentials(prisma, bot.workspaceId);
    if (scoped && scoped.clientId && scoped.clientSecret) return scoped;

    return {
      clientId: readEnvValue("SYNC_PAY_CLIENT_ID", "SYNCPAY_CLIENT_ID", "SYNC_PAY_CLIENTID", "SYNCPAY_CLIENTID") || "",
      clientSecret: readEnvValue("SYNC_PAY_CLIENT_SECRET", "SYNCPAY_CLIENT_SECRET", "SYNC_PAY_CLIENTSECRET", "SYNCPAY_CLIENTSECRET") || "",
    };
  }
  return {};
}

module.exports = {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  resolvePaymentCredentials,
  resolvePlatformReceivingCredentials,
};