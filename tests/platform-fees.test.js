const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PLATFORM_FEE_CONFIG,
  isPlatformFeeExemptGateway,
  calculatePlatformFeeCents,
  recordPaidOrderFee,
  recordPlatformFeeRefund,
  markPlatformFeeReceived,
  getWorkspaceFeeSummary,
} = require("../src/lib/platform-fees.js");

const paidOrder = {
  id: "order_123",
  paymentId: "provider_tx_123",
  paymentGateway: "mercadopago",
  billingType: "one_time",
  bot: { workspaceId: "workspace_123" },
};

function createLedgerTransaction(existing = new Set()) {
  const rows = [];
  const events = [];
  return {
    rows,
    events,
    platformFeeLedger: {
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const row of data) {
          if (existing.has(row.idempotencyKey)) {
            assert.equal(skipDuplicates, true);
            continue;
          }
          existing.add(row.idempotencyKey);
          rows.push(row);
          count += 1;
        }
        return { count };
      },
      findUnique: async ({ where }) => {
        const row = rows.find((item) => item.idempotencyKey === where.idempotencyKey);
        return row ? { ...row, id: `ledger-${rows.indexOf(row)}` } : null;
      },
      updateMany: async ({ where, data }) => {
        const row = rows.find((item) => item.idempotencyKey === where.idempotencyKey);
        const statusMatches = typeof where.status === "string"
          ? row?.status === where.status
          : !where.status?.not || row?.status !== where.status.not;
        if (row && statusMatches) Object.assign(row, data);
        return { count: row && statusMatches ? 1 : 0 };
      },
    },
    platformFeeEvent: { create: async ({ data }) => { events.push(data); return data; } },
  };
}

test("platform fee is fixed at 30 integer cents", () => {
  assert.deepEqual(PLATFORM_FEE_CONFIG, { enabled: true, type: "FIXED", amountCents: 30, currency: "BRL" });
  assert.equal(calculatePlatformFeeCents({ gateway: "mercadopago", paymentStatus: "PAID" }), 30);
  assert.equal(calculatePlatformFeeCents({ gateway: "amplopay", paymentStatus: "PAID" }), 30);
  assert.equal(calculatePlatformFeeCents({ gateway: "syncpay", paymentStatus: "PAID" }), 30);
  assert.equal(calculatePlatformFeeCents({ gateway: "new_provider", paymentStatus: "PAID" }), 30);
  assert.equal(Number.isInteger(calculatePlatformFeeCents({ gateway: "mercadopago", paymentStatus: "PAID" })), true);
});

test("PIX Direto is exempt and does not create a monetary fee", async () => {
  assert.equal(isPlatformFeeExemptGateway("pix_direto"), true);
  assert.equal(calculatePlatformFeeCents({ gateway: "pix_direto", paymentStatus: "PAID" }), 0);
  const transaction = createLedgerTransaction();
  const result = await recordPaidOrderFee(transaction, { ...paidOrder, paymentGateway: "pix_direto" }, { paymentStatus: "PAID" });
  assert.equal(result.status, "WAIVED");
  assert.equal(transaction.rows[0].amountCents, 0);
  assert.equal(transaction.rows[0].status, "WAIVED");
  assert.equal(transaction.events[0].eventType, "FEE_WAIVED");
});

test("unconfirmed payment statuses never generate a fee", async () => {
  const transaction = createLedgerTransaction();
  for (const paymentStatus of ["PENDING", "FAILED", "CANCELLED", "EXPIRED", "APPROVED"]) {
    const result = await recordPaidOrderFee(transaction, paidOrder, { paymentStatus });
    assert.equal(result.created, false);
    assert.equal(result.reason, "payment_not_confirmed");
  }
  assert.equal(transaction.rows.length, 0);
});

test("paid fee is pending unless an actual split is confirmed", async () => {
  const transaction = createLedgerTransaction();
  const result = await recordPaidOrderFee(transaction, paidOrder, { paymentStatus: "PAID" });
  assert.equal(result.amountCents, 30);
  assert.equal(result.status, "PENDING");
  assert.equal(transaction.rows[0].status, "PENDING");
  assert.equal(transaction.rows[0].receivedAt, null);
});

test("duplicate paid event creates one fee row", async () => {
  const transaction = createLedgerTransaction();
  const first = await recordPaidOrderFee(transaction, paidOrder, { paymentStatus: "PAID" });
  const second = await recordPaidOrderFee(transaction, paidOrder, { paymentStatus: "PAID" });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(transaction.rows.length, 1);
});

test("confirmed split is recorded received only with an explicit confirmation", async () => {
  const transaction = createLedgerTransaction();
  const result = await recordPaidOrderFee(transaction, paidOrder, {
    paymentStatus: "PAID",
    splitConfirmed: true,
    splitReference: "confirmed-provider-reference",
  });
  assert.equal(result.status, "RECEIVED");
  assert.equal(transaction.rows[0].receivedAt instanceof Date, true);
  assert.equal(transaction.rows[0].providerReference, "confirmed-provider-reference");
});

test("refund preserves the original fee and creates one negative adjustment", async () => {
  const transaction = createLedgerTransaction();
  await recordPaidOrderFee(transaction, paidOrder, { paymentStatus: "PAID" });
  const first = await recordPlatformFeeRefund(transaction, paidOrder, { refundReference: "refund_123" });
  const duplicate = await recordPlatformFeeRefund(transaction, paidOrder, { refundReference: "refund_123" });
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(transaction.rows.length, 2);
  assert.equal(transaction.rows[0].amountCents, 30);
  assert.equal(transaction.rows[0].status, "REFUNDED");
  assert.equal(transaction.rows[1].amountCents, -30);
  assert.equal(transaction.rows[1].entryType, "REFUND_ADJUSTMENT");
  assert.equal(transaction.events.some((event) => event.eventType === "FEE_REFUNDED"), true);
  assert.equal(transaction.events.some((event) => event.eventType === "REFUND_ADJUSTMENT_CREATED"), true);
});

test("a pending fee becomes received only after exact split amount confirmation", async () => {
  const transaction = createLedgerTransaction();
  const splitOrder = { ...paidOrder, platformFeeSplitRequested: true };
  await recordPaidOrderFee(transaction, splitOrder, { paymentStatus: "PAID" });

  const notExact = await markPlatformFeeReceived(transaction, splitOrder, { confirmedAmountCents: 29 });
  const confirmed = await markPlatformFeeReceived(transaction, splitOrder, {
    confirmedAmountCents: 30,
    providerReference: "mp-payment-123",
  });
  const duplicate = await markPlatformFeeReceived(transaction, splitOrder, { confirmedAmountCents: 30 });

  assert.equal(notExact.received, false);
  assert.equal(confirmed.received, true);
  assert.equal(duplicate.received, false);
  assert.equal(transaction.rows[0].status, "RECEIVED");
  assert.equal(transaction.rows[0].providerReference, "mp-payment-123");
  assert.equal(transaction.events.some((event) => event.eventType === "SPLIT_RECEIVED"), true);
});

test("AmploPay paid orders create a 30-cent pending fee without a verified split", async () => {
  const transaction = createLedgerTransaction();
  const result = await recordPaidOrderFee(transaction, { ...paidOrder, paymentGateway: "amplopay" }, { paymentStatus: "PAID" });
  assert.equal(result.amountCents, 30);
  assert.equal(result.status, "PENDING");
});

test("each paid recurring invoice uses its own provider transaction id", async () => {
  const transaction = createLedgerTransaction();
  const first = { ...paidOrder, paymentId: "subscription-invoice-1", billingType: "recurring", recurringInterval: "monthly" };
  const second = { ...paidOrder, id: "order_124", paymentId: "subscription-invoice-2", billingType: "recurring", recurringInterval: "monthly" };
  await recordPaidOrderFee(transaction, first, { paymentStatus: "PAID" });
  await recordPaidOrderFee(transaction, second, { paymentStatus: "PAID" });
  assert.equal(transaction.rows.length, 2);
  assert.deepEqual(transaction.rows.map((row) => row.amountCents), [30, 30]);
});

test("recurring PIX Direto invoices remain exempt", async () => {
  const transaction = createLedgerTransaction();
  const order = { ...paidOrder, paymentGateway: "pix_direto", billingType: "recurring", recurringInterval: "monthly" };
  const result = await recordPaidOrderFee(transaction, order, { paymentStatus: "PAID" });
  assert.equal(result.amountCents, 0);
  assert.equal(result.status, "WAIVED");
});

test("tenant fee summary queries only workspaces owned by the authenticated user", async () => {
  const prisma = {
    workspace: {
      findMany: async ({ where }) => {
        assert.deepEqual(where, { userId: "tenant-a" });
        return [{ id: "workspace-a" }];
      },
    },
    platformFeeLedger: {
      groupBy: async ({ where }) => {
        assert.deepEqual(where, { workspaceId: { in: ["workspace-a"] } });
        return [
          { status: "PENDING", entryType: "SALE_FEE", _sum: { amountCents: 60 }, _count: { _all: 2 } },
          { status: "WAIVED", entryType: "SALE_FEE", _sum: { amountCents: 0 }, _count: { _all: 1 } },
        ];
      },
    },
  };

  const summary = await getWorkspaceFeeSummary(prisma, "tenant-a");
  assert.equal(summary.pendingCents, 60);
  assert.equal(summary.waivedSales, 1);
});