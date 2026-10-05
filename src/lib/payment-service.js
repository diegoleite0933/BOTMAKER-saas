const { createHmac, timingSafeEqual } = require("node:crypto");

const providerFactories = {
  mercadopago: async (request) => {
    const gatewayModule = await import("./payment-gateways.js");
    const { createMercadoPagoPix } = gatewayModule.default || gatewayModule;
    const payment = await createMercadoPagoPix({
      accessToken: request.credentials.accessToken,
      orderId: request.orderId,
      amount: request.amount,
      description: request.description,
      notificationUrl: request.notificationUrl,
      payerEmail: request.payerEmail,
      payerName: request.payerName,
      applicationFeeCents: request.applicationFeeCents,
      fetchImpl: request.fetchImpl,
    });
    return {
      paymentId: payment.paymentId,
      pixCode: payment.pixCode,
      qrCodeBase64: payment.qrCodeBase64,
      ticketUrl: payment.ticketUrl,
      platformFeeSplitRequested: payment.applicationFeeCents === 30,
    };
  },
  amplopay: async (request) => {
    const gatewayModule = await import("./payment-gateways.js");
    const { createAmploPayPix } = gatewayModule.default || gatewayModule;
    const payment = await createAmploPayPix({
      clientId: request.credentials.clientId,
      clientSecret: request.credentials.clientSecret,
      payload: request.amploPayload,
      fetchImpl: request.fetchImpl,
    });
    return { paymentId: payment.paymentId, pixCode: payment.pixCode };
  },
  pix_direto: async (request) => {
    const pixModule = await import("./pix-code.js");
    const { generatePixQr } = pixModule.default || pixModule;
    const payment = await generatePixQr({
      pixKey: request.credentials.pixKey,
      merchantName: request.merchantName,
      merchantCity: request.merchantCity,
      amount: request.amount,
      transactionId: request.orderId,
    });
    return {
      paymentId: null,
      pixCode: payment.copyPasteCode,
      qrCode: payment.qrCode,
    };
  },
  syncpay: async (request) => {
    const gatewayModule = await import("./syncpay.js");
    const { createSyncPayPixCharge } = gatewayModule.default || gatewayModule;
    const payment = await createSyncPayPixCharge({
      accessToken: request.credentials.accessToken,
      clientId: request.credentials.clientId,
      clientSecret: request.credentials.clientSecret,
      amount: request.amount,
      description: request.description,
      client: {
        name: request.payerName,
        email: request.payerEmail,
        phone: request.phone || "11999999999",
        cpf: request.cpf || "00000000000",
      },
      webhookUrl: request.notificationUrl,
      fetchImpl: request.fetchImpl,
    });
    return {
      paymentId: payment.identifier,
      pixCode: payment.pixCode,
      qrCodeBase64: payment.qrCodeBase64,
      ticketUrl: payment.ticketUrl,
      identifier: payment.identifier,
    };
  },
};

function createPaymentWebhookSignature(orderId) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET precisa estar configurado para assinar webhooks.");
  return createHmac("sha256", secret).update(orderId).digest("hex");
}

function verifyPaymentWebhookSignature(orderId, signature) {
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  try {
    const expected = Buffer.from(createPaymentWebhookSignature(orderId), "hex");
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

async function createPixPayment(request) {
  const provider = providerFactories[request.provider];
  if (!provider) throw new Error("Gateway PIX não suportado.");
  return { provider: request.provider, ...(await provider(request)) };
}

module.exports = { createPixPayment, createPaymentWebhookSignature, verifyPaymentWebhookSignature };