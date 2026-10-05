import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";
import { deliverPaidOrder } from "@/lib/product-delivery.js";
import { resolvePaymentCredentials } from "@/lib/payment-credentials.js";
import { normalizeSyncPayStatus, verifySyncPayWebhookSignature } from "@/lib/syncpay.js";
import { getSyncPayTransaction } from "@/lib/syncpay.js";
import { recordPlatformFeeRefund } from "@/lib/platform-fees.js";

const prisma = new PrismaClient();

function readWebhookIdentifier(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const document = payload as Record<string, unknown>;
  const direct = document.identifier ?? document.id ?? document.transactionId ?? document.transaction_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = document.data as Record<string, unknown> | undefined;
  if (nested) {
    const nestedIdentifier = nested.identifier ?? nested.id ?? nested.transactionId ?? nested.transaction_id;
    if (typeof nestedIdentifier === "string" && nestedIdentifier.trim()) return nestedIdentifier.trim();
  }
  const transaction = document.transaction as Record<string, unknown> | undefined;
  if (transaction) {
    const transactionIdentifier = transaction.identifier ?? transaction.id ?? transaction.transactionId ?? transaction.transaction_id;
    if (typeof transactionIdentifier === "string" && transactionIdentifier.trim()) return transactionIdentifier.trim();
  }
  const event = document.event as Record<string, unknown> | undefined;
  if (event) {
    const eventIdentifier = event.identifier ?? event.id ?? event.transactionId ?? event.transaction_id;
    if (typeof eventIdentifier === "string" && eventIdentifier.trim()) return eventIdentifier.trim();
  }
  return null;
}

function readWebhookStatus(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "pending";
  const document = payload as Record<string, unknown>;
  const direct = document.status ?? document.state ?? document.event?.status;
  if (typeof direct === "string") return normalizeSyncPayStatus(direct);
  const data = document.data as Record<string, unknown> | undefined;
  if (data && typeof data.status === "string") return normalizeSyncPayStatus(data.status);
  const transaction = document.transaction as Record<string, unknown> | undefined;
  if (transaction && typeof transaction.status === "string") return normalizeSyncPayStatus(transaction.status);
  const event = document.event as Record<string, unknown> | undefined;
  if (event && typeof event.status === "string") return normalizeSyncPayStatus(event.status);
  return "pending";
}

function readWebhookAmount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const document = payload as Record<string, unknown>;
  const amount = document.amount ?? document.total_amount ?? document.value ?? document.totalValue;
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) return parsed;
  }
  const transaction = document.transaction as Record<string, unknown> | undefined;
  if (transaction) {
    const transactionAmount = transaction.amount ?? transaction.total_amount ?? transaction.value;
    if (typeof transactionAmount === "number") return transactionAmount;
    if (typeof transactionAmount === "string") {
      const parsed = Number(transactionAmount);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  const data = document.data as Record<string, unknown> | undefined;
  if (data) {
    const nestedAmount = data.amount ?? data.total_amount ?? data.value;
    if (typeof nestedAmount === "number") return nestedAmount;
    if (typeof nestedAmount === "string") {
      const parsed = Number(nestedAmount);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const identifier = readWebhookIdentifier(payload);
    if (!identifier) {
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    const signatureHeader = req.headers.get("x-syncpay-signature") || req.headers.get("x-signature") || req.headers.get("x-webhook-signature");
    const order = await prisma.order.findFirst({
      where: { paymentId: identifier },
      include: { bot: true, product: { include: { deliveries: true } }, bumpProduct: { include: { deliveries: true } } },
    });

    if (order) {
      const credentials = await resolvePaymentCredentials(prisma, order.bot, "syncpay");
      if (!credentials.clientId || !credentials.clientSecret) {
        return NextResponse.json({ message: "Credenciais SyncPay do tenant não configuradas." }, { status: 503 });
      }
      if (signatureHeader && !verifySyncPayWebhookSignature(rawBody, signatureHeader, credentials.clientSecret)) {
        return NextResponse.json({ message: "Assinatura do webhook SyncPay inválida." }, { status: 401 });
      }

      const providerTransaction = await getSyncPayTransaction({
        accessToken: credentials.accessToken,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        identifier,
      });
      const officialIdentifier = readWebhookIdentifier(providerTransaction);
      const officialAmount = readWebhookAmount(providerTransaction);
      const officialStatus = readWebhookStatus(providerTransaction);
      const expectedAmountCents = Math.round(Number(order.amount) * 100);
      const actualAmountCents = officialAmount === null ? null : Math.round(officialAmount * 100);
      if (officialIdentifier !== identifier || actualAmountCents === null || actualAmountCents !== expectedAmountCents) {
        return NextResponse.json({ message: "A consulta oficial SyncPay não corresponde ao pedido." }, { status: 422 });
      }

      const eventKey = { source: "syncpay", eventId: `${identifier}:${officialStatus}` };
      const existingEvent = await prisma.webhookEvent.findUnique({ where: { source_eventId: eventKey } });
      if (existingEvent?.status === "processed") {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }

      await prisma.webhookEvent.upsert({
        where: { source_eventId: eventKey },
        create: { ...eventKey, payload: rawBody, status: "pending" },
        update: { payload: rawBody, status: "pending", error: null },
      });

      if (officialStatus === "paid" && !["paid", "refunded"].includes(order.status)) {
        const bot = new Telegraf(order.bot.token);
        await deliverPaidOrder({ prisma, bot, order });
      } else if (officialStatus === "refunded" && order.status === "paid") {
        const result = await prisma.$transaction(async (transaction) => {
          await transaction.order.updateMany({ where: { id: order.id, status: "paid" }, data: { status: "refunded" } });
          return recordPlatformFeeRefund(transaction, order, { refundReference: identifier });
        });
        if (result.created) {
          console.info(`[PLATFORM_FEE] tenant=${order.bot.workspaceId} gateway=syncpay transaction=${identifier} sale=${order.id} fee=${result.amountCents} status=REFUND_ADJUSTMENT`);
        }
      } else if (["failed", "cancelled"].includes(officialStatus)) {
        await prisma.order.updateMany({
          where: { id: order.id, status: { in: ["pending", "review"] } },
          data: { status: officialStatus },
        });
      }

      await prisma.webhookEvent.update({
        where: { source_eventId: eventKey },
        data: { status: "processed", error: null },
      });

      return NextResponse.json({ received: true, status: officialStatus });
    }

    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  } catch (error) {
    console.error("Erro webhook SyncPay:", error);
    return NextResponse.json({ message: "Webhook SyncPay inválido ou não processado." }, { status: 500 });
  }
}
