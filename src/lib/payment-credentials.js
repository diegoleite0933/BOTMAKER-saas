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
    if (integration) return decryptPaymentCredentials(integration.encryptedCredentials);
  }

  if (provider === "mercadopago") return { accessToken: bot.mpAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || "" };
  if (provider === "amplopay") {
    return {
      clientId: bot.amploPayClientId || process.env.AMPLOPAY_CLIENT_ID || "",
      clientSecret: bot.amploPayClientSecret || process.env.AMPLOPAY_CLIENT_SECRET || "",
    };
  }
  if (provider === "pix_direto") return { pixKey: bot.pixKey || "" };
  return {};
}

module.exports = { decryptPaymentCredentials, encryptPaymentCredentials, resolvePaymentCredentials };