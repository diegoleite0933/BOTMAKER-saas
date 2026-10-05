const { createHash } = require("node:crypto");

const PLATFORM_FEE_CONFIG = Object.freeze({
  enabled: true,
  type: "FIXED",
  amountCents: 30,
  currency: "BRL",
});

const FEE_EXEMPT_GATEWAYS = new Set(["pix_direto"]);

function normalizeGateway(gateway) {
  return typeof gateway === "string" ? gateway.trim().toLowerCase() : "unknown";
}

function isPlatformFeeExemptGateway(gateway) {
  return FEE_EXEMPT_GATEWAYS.has(normalizeGateway(gateway));
}

function calculatePlatformFeeCents({ gateway, paymentStatus }) {
  if (paymentStatus !== "PAID" || !PLATFORM_FEE_CONFIG.enabled) return 0;
  if (isPlatformFeeExemptGateway(gateway)) return 0;
  return PLATFORM_FEE_CONFIG.amountCents;
}

function makeIdempotencyKey(parts) {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

function feeKey({ workspaceId, gateway, providerTransactionId, entryType }) {
  return makeIdempotencyKey([workspaceId, normalizeGateway(gateway), providerTransactionId, entryType]);
}

async function recordPaidOrderFee(transaction, order, { paymentStatus, splitConfirmed = false, splitReference = null, now = new Date() } = {}) {
  if (paymentStatus !== "PAID") return { created: false, reason: "payment_not_confirmed" };
  if (!order?.id || !order?.bot?.workspaceId) throw new Error("Pedido pago sem workspace associado.");

  const gateway = normalizeGateway(order.paymentGateway || order.bot.paymentMethod);
  const providerTransactionId = String(order.paymentId || order.id);
  const isExempt = isPlatformFeeExemptGateway(gateway);
  const amountCents = calculatePlatformFeeCents({ gateway, paymentStatus });
  const idempotencyKey = feeKey({
    workspaceId: order.bot.workspaceId,
    gateway,
    providerTransactionId,
    entryType: "SALE_FEE",
  });

  const result = await transaction.platformFeeLedger.createMany({
    data: [{
      workspaceId: order.bot.workspaceId,
      orderId: order.id,
      gateway,
      providerTransactionId,
      entryType: "SALE_FEE",
      amountCents,
      currency: PLATFORM_FEE_CONFIG.currency,
      status: isExempt ? "WAIVED" : splitConfirmed ? "RECEIVED" : "PENDING",
      providerReference: splitReference,
      paidAt: now,
      receivedAt: splitConfirmed && !isExempt ? now : null,
      idempotencyKey,
      metadata: JSON.stringify({
        billingType: order.billingType || "one_time",
        recurringInterval: order.recurringInterval || null,
        exemption: isExempt ? "PIX_DIRETO" : null,
      }),
    }],
    skipDuplicates: true,
  });

  if (result.count) {
    const ledger = await transaction.platformFeeLedger.findUnique({ where: { idempotencyKey }, select: { id: true } });
    await transaction.platformFeeEvent.create({
      data: {
        ledgerId: ledger.id,
        eventType: isExempt ? "FEE_WAIVED" : splitConfirmed ? "SPLIT_RECEIVED" : "FEE_GENERATED",
        fromStatus: null,
        toStatus: isExempt ? "WAIVED" : splitConfirmed ? "RECEIVED" : "PENDING",
        reference: splitReference,
        metadata: JSON.stringify({ amountCents, gateway }),
      },
    });
  }

  return { created: result.count === 1, amountCents, status: isExempt ? "WAIVED" : splitConfirmed ? "RECEIVED" : "PENDING" };
}

async function recordPlatformFeeRefund(transaction, order, { refundReference, now = new Date() } = {}) {
  if (!order?.id || !order?.bot?.workspaceId) throw new Error("Pedido reembolsado sem workspace associado.");

  const gateway = normalizeGateway(order.paymentGateway || order.bot.paymentMethod);
  const providerTransactionId = String(order.paymentId || order.id);
  const saleFeeKey = feeKey({
    workspaceId: order.bot.workspaceId,
    gateway,
    providerTransactionId,
    entryType: "SALE_FEE",
  });
  const originalFee = await transaction.platformFeeLedger.findUnique({ where: { idempotencyKey: saleFeeKey } });
  if (!originalFee || originalFee.status === "WAIVED" || originalFee.amountCents <= 0) {
    return { created: false, reason: "no_collectible_fee" };
  }

  const stableRefundReference = String(refundReference || "full_refund");
  const adjustmentKey = makeIdempotencyKey([
    order.bot.workspaceId,
    gateway,
    providerTransactionId,
    "REFUND_ADJUSTMENT",
    stableRefundReference,
  ]);
  const result = await transaction.platformFeeLedger.createMany({
    data: [{
      workspaceId: order.bot.workspaceId,
      orderId: order.id,
      gateway,
      providerTransactionId,
      entryType: "REFUND_ADJUSTMENT",
      amountCents: -originalFee.amountCents,
      currency: originalFee.currency,
      status: "PENDING",
      providerReference: stableRefundReference,
      paidAt: now,
      idempotencyKey: adjustmentKey,
      metadata: JSON.stringify({ reverses: originalFee.idempotencyKey }),
    }],
    skipDuplicates: true,
  });

  const originalUpdate = await transaction.platformFeeLedger.updateMany({
    where: { idempotencyKey: saleFeeKey, status: { not: "REFUNDED" } },
    data: { status: "REFUNDED" },
  });

  if (originalUpdate.count) {
    await transaction.platformFeeEvent.create({
      data: {
        ledgerId: originalFee.id,
        eventType: "FEE_REFUNDED",
        fromStatus: originalFee.status,
        toStatus: "REFUNDED",
        reference: stableRefundReference,
        metadata: JSON.stringify({ adjustmentIdempotencyKey: adjustmentKey }),
      },
    });
  }
  if (result.count) {
    const adjustment = await transaction.platformFeeLedger.findUnique({ where: { idempotencyKey: adjustmentKey }, select: { id: true } });
    await transaction.platformFeeEvent.create({
      data: {
        ledgerId: adjustment.id,
        eventType: "REFUND_ADJUSTMENT_CREATED",
        fromStatus: null,
        toStatus: "PENDING",
        reference: stableRefundReference,
        metadata: JSON.stringify({ amountCents: -originalFee.amountCents }),
      },
    });
  }

  return { created: result.count === 1, amountCents: -originalFee.amountCents, status: "PENDING" };
}

async function markPlatformFeeReceived(transaction, order, { providerReference, confirmedAmountCents, now = new Date() } = {}) {
  if (confirmedAmountCents !== PLATFORM_FEE_CONFIG.amountCents || !order?.platformFeeSplitRequested) {
    return { received: false, reason: "split_not_confirmed" };
  }
  const gateway = normalizeGateway(order.paymentGateway || order.bot?.paymentMethod);
  const providerTransactionId = String(order.paymentId || order.id);
  const idempotencyKey = feeKey({
    workspaceId: order.bot.workspaceId,
    gateway,
    providerTransactionId,
    entryType: "SALE_FEE",
  });
  const result = await transaction.platformFeeLedger.updateMany({
    where: { idempotencyKey, amountCents: PLATFORM_FEE_CONFIG.amountCents, status: "PENDING" },
    data: { status: "RECEIVED", providerReference: providerReference || null, receivedAt: now },
  });
  if (result.count) {
    const ledger = await transaction.platformFeeLedger.findUnique({ where: { idempotencyKey }, select: { id: true } });
    await transaction.platformFeeEvent.create({
      data: {
        ledgerId: ledger.id,
        eventType: "SPLIT_RECEIVED",
        fromStatus: "PENDING",
        toStatus: "RECEIVED",
        reference: providerReference || null,
        metadata: JSON.stringify({ amountCents: confirmedAmountCents }),
      },
    });
  }
  return { received: result.count === 1, reason: result.count ? null : "fee_not_pending_or_already_received" };
}

async function getWorkspaceFeeSummary(prisma, userId) {
  const workspaces = await prisma.workspace.findMany({ where: { userId }, select: { id: true } });
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  if (!workspaceIds.length) {
    return { generatedCents: 0, pendingCents: 0, receivedCents: 0, failedCents: 0, refundedAdjustmentCents: 0, waivedSales: 0 };
  }

  const groups = await prisma.platformFeeLedger.groupBy({
    by: ["status", "entryType"],
    where: { workspaceId: { in: workspaceIds } },
    _sum: { amountCents: true },
    _count: { _all: true },
  });
  const getSum = (status, entryType) => groups.find((group) => group.status === status && group.entryType === entryType)?._sum.amountCents || 0;
  const getCount = (status, entryType) => groups.find((group) => group.status === status && group.entryType === entryType)?._count._all || 0;
  return {
    generatedCents: groups.filter((group) => group.entryType === "SALE_FEE").reduce((total, group) => total + (group._sum.amountCents || 0), 0),
    pendingCents: getSum("PENDING", "SALE_FEE"),
    receivedCents: getSum("RECEIVED", "SALE_FEE"),
    failedCents: getSum("FAILED", "SALE_FEE"),
    refundedAdjustmentCents: groups.filter((group) => group.entryType === "REFUND_ADJUSTMENT").reduce((total, group) => total + (group._sum.amountCents || 0), 0),
    waivedSales: getCount("WAIVED", "SALE_FEE"),
  };
}

module.exports = {
  PLATFORM_FEE_CONFIG,
  isPlatformFeeExemptGateway,
  calculatePlatformFeeCents,
  recordPaidOrderFee,
  recordPlatformFeeRefund,
  markPlatformFeeReceived,
  getWorkspaceFeeSummary,
};