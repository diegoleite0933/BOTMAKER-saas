const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createMercadoPagoPix } = require("../src/lib/payment-gateways.js");
const { verifyMercadoPagoWebhookSignature } = require("../src/lib/mercadopago-marketplace.js");

function createMercadoPagoResponse(fetchImpl) {
  let requestBody;
  const response = createMercadoPagoPix({
    accessToken: "seller-oauth-access-token",
    orderId: "order_marketplace_1",
    amount: 100,
    description: "Venda",
    notificationUrl: "https://example.com/api/webhooks/mercadopago",
    payerEmail: "buyer@example.com",
    payerName: "Comprador",
    applicationFeeCents: fetchImpl.applicationFeeCents,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({
          id: 3001,
          point_of_interaction: { transaction_data: { qr_code: "pix-code" } },
        }),
      };
    },
  });
  return response.then((result) => ({ result, requestBody }));
}

test("Mercado Pago sends fixed application_fee only when split is enabled", async () => {
  const withSplit = await createMercadoPagoResponse({ applicationFeeCents: 30 });
  const withoutSplit = await createMercadoPagoResponse({ applicationFeeCents: null });

  assert.equal(withSplit.requestBody.application_fee, 0.3);
  assert.equal(withSplit.result.applicationFeeCents, 30);
  assert.equal(Object.hasOwn(withoutSplit.requestBody, "application_fee"), false);
  assert.equal(withoutSplit.result.applicationFeeCents, null);
});

test("Mercado Pago webhook signature validates official manifest and rejects tampering", () => {
  const secret = "mp-webhook-test-secret";
  const dataId = "PAYMENT-123";
  const requestId = "request-abc";
  const timestamp = "1710000000";
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const signature = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const headers = { signature: `ts=${timestamp},v1=${signature}`, requestId, dataId, secret };

  assert.equal(verifyMercadoPagoWebhookSignature(headers), true);
  assert.equal(verifyMercadoPagoWebhookSignature({ ...headers, dataId: "other-payment" }), false);
  assert.equal(verifyMercadoPagoWebhookSignature({ ...headers, signature: undefined }), false);
});