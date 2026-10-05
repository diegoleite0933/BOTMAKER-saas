const test = require("node:test");
const assert = require("node:assert/strict");
const { deliverPaidOrder } = require("../src/lib/product-delivery.js");

function setup(paymentGateway = "mercadopago") {
  const ledgerRows = [];
  let status = "pending";
  const prisma = {
    $transaction: async (callback) => callback({
      order: {
        updateMany: async () => {
          if (status === "paid") return { count: 0 };
          status = "paid";
          return { count: 1 };
        },
      },
      platformFeeLedger: {
        createMany: async ({ data, skipDuplicates }) => {
          assert.equal(skipDuplicates, true);
          if (ledgerRows.some((row) => row.idempotencyKey === data[0].idempotencyKey)) return { count: 0 };
          ledgerRows.push(data[0]);
          return { count: 1 };
        },
        findUnique: async ({ where }) => {
          const row = ledgerRows.find((item) => item.idempotencyKey === where.idempotencyKey);
          return row ? { ...row, id: "ledger-fee-1" } : null;
        },
      },
      platformFeeEvent: { create: async () => undefined },
      access: { create: async () => undefined },
    }),
  };
  const bot = { telegram: { sendMessage: async () => undefined } };
  const order = {
    id: "order_delivery_1",
    paymentId: "provider_delivery_1",
    paymentGateway,
    billingType: "one_time",
    botId: "bot_1",
    telegramUserId: "tg_user_1",
    bot: { workspaceId: "workspace_1" },
    product: { id: "product_1", name: "Test product", deliveries: [{ id: "delivery_1", type: "file", content: "https://example.com/item" }] },
    bumpProduct: null,
  };
  return { prisma, bot, order, ledgerRows };
}

test("delivery transaction records one pending platform fee on first paid transition", async () => {
  const { prisma, bot, order, ledgerRows } = setup();
  assert.equal(await deliverPaidOrder({ prisma, bot, order }), true);
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].amountCents, 30);
  assert.equal(ledgerRows[0].status, "PENDING");
});

test("repeated delivery does not create a second platform fee", async () => {
  const { prisma, bot, order, ledgerRows } = setup();
  assert.equal(await deliverPaidOrder({ prisma, bot, order }), true);
  assert.equal(await deliverPaidOrder({ prisma, bot, order }), false);
  assert.equal(ledgerRows.length, 1);
});

test("PIX Direto delivery creates only a zero-value waived audit entry", async () => {
  const { prisma, bot, order, ledgerRows } = setup("pix_direto");
  assert.equal(await deliverPaidOrder({ prisma, bot, order }), true);
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].amountCents, 0);
  assert.equal(ledgerRows[0].status, "WAIVED");
});