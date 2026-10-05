const { createHmac, timingSafeEqual } = require("node:crypto");

const SYNC_PAY_BASE_URL = "https://api.syncpayments.com.br/api/partner/v1";

function getSyncPayBaseUrl() {
  return SYNC_PAY_BASE_URL;
}

function normalizeSyncPayStatus(status) {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (!value) return "pending";

  const map = {
    approved: "paid",
    completed: "paid",
    paid: "paid",
    success: "paid",
    processing: "pending",
    pending: "pending",
    waiting: "pending",
    failed: "failed",
    rejected: "failed",
    cancelled: "cancelled",
    canceled: "cancelled",
    expired: "cancelled",
    refunded: "refunded",
    active: "active",
    overdue: "overdue",
    suspended: "suspended",
    late: "overdue",
    inactive: "inactive",
  };

  return map[value] || value;
}

function verifySyncPayWebhookSignature(payloadString, signature, clientSecret) {
  if (typeof payloadString !== "string" || typeof signature !== "string" || typeof clientSecret !== "string") {
    return false;
  }

  const normalizedSignature = signature.trim().replace(/^sha256=/i, "");
  if (!normalizedSignature) return false;

  const expected = createHmac("sha256", clientSecret).update(payloadString).digest("hex");
  const received = Buffer.from(normalizedSignature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (received.length !== expectedBuffer.length) return false;
  try {
    return timingSafeEqual(received, expectedBuffer);
  } catch {
    return false;
  }
}

async function exchangeSyncPayAccessToken({ clientId, clientSecret, fetchImpl = fetch }) {
  if (!clientId || !clientSecret) {
    throw new Error("Client ID e Client Secret da SyncPay são obrigatórios.");
  }

  const response = await fetchImpl(`${SYNC_PAY_BASE_URL}/auth-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Falha ao autenticar na SyncPay.");
  }

  const data = await response.json();
  const accessToken = data.access_token || data.token || data.accessToken;
  if (!accessToken) {
    throw new Error("A SyncPay não retornou um access token válido.");
  }

  return {
    accessToken,
    expiresIn: data.expires_in || 3600,
    expiresAt: data.expires_at || null,
  };
}

async function createSyncPayPixCharge({ accessToken, clientId, clientSecret, amount, description, client, webhookUrl, fetchImpl = fetch }) {
  const token = accessToken || (clientId && clientSecret ? (await exchangeSyncPayAccessToken({ clientId, clientSecret, fetchImpl })).accessToken : "");

  if (!token) {
    throw new Error("A SyncPay não está autenticada para gerar a cobrança PIX.");
  }

  const payload = {
    amount: Number(amount),
    description: description || "Pagamento Odisseia Bot",
    client: {
      name: client?.name || "Cliente Telegram",
      email: client?.email || "cliente@odisseiabot.com",
      cpf: client?.cpf || "00000000000",
      phone: client?.phone || "11999999999",
      ...(client || {}),
    },
    ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
  };

  const response = await fetchImpl(`${SYNC_PAY_BASE_URL}/cash-in`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "A SyncPay rejeitou a cobrança PIX.");
  }

  const data = await response.json();
  const pixCode = data.pix_code || data.pixCode || data.pix_payload || "";
  return {
    message: data.message || "Cobrança PIX criada com sucesso.",
    pixCode,
    identifier: data.identifier || data.id || null,
    qrCodeBase64: data.qr_code_base64 || data.qrCodeBase64 || null,
    ticketUrl: data.ticket_url || data.ticketUrl || null,
  };
}

async function getSyncPayTransaction({ accessToken, clientId, clientSecret, identifier, fetchImpl = fetch }) {
  const token = accessToken || (clientId && clientSecret ? (await exchangeSyncPayAccessToken({ clientId, clientSecret, fetchImpl })).accessToken : "");
  if (!token || !identifier) {
    throw new Error("A transação da SyncPay não foi encontrada ou a autenticação está ausente.");
  }

  const response = await fetchImpl(`${SYNC_PAY_BASE_URL}/transaction/${encodeURIComponent(identifier)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Transação SyncPay não encontrada.");
  }

  return response.json();
}

module.exports = {
  SYNC_PAY_BASE_URL,
  getSyncPayBaseUrl,
  normalizeSyncPayStatus,
  verifySyncPayWebhookSignature,
  exchangeSyncPayAccessToken,
  createSyncPayPixCharge,
  getSyncPayTransaction,
};
