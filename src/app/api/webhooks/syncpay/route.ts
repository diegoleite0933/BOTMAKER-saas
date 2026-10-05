import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";
import { deliverPaidOrder } from "@/lib/product-delivery.js";
import { resolvePaymentCredentials } from "@/lib/payment-credentials.js";
import { normalizeSyncPayStatus, verifySyncPayWebhookSignature } from "@/lib/syncpay.js";

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
      if (credentials.clientSecret && signatureHeader) {
        if (!verifySyncPayWebhookSignature(rawBody, signatureHeader, credentials.clientSecret)) {
          return NextResponse.json({ message: "Assinatura do webhook SyncPay inválida." }, { status: 401 });
        }
      }
    }

    const eventKey = { source: "syncpay", eventId: identifier };
    const existingEvent = await prisma.webhookEvent.findUnique({ where: { source_eventId: eventKey } });
    if (existingEvent) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    const status = readWebhookStatus(payload);
    const amount = readWebhookAmount(payload);

    if (order && amount !== null && Math.abs(Number(amount) - Number(order.amount)) > 0.01) {
      return NextResponse.json({ message: "Valor do webhook não corresponde ao pedido." }, { status: 422 });
    }

    await prisma.webhookEvent.create({
      data: {
        source: "syncpay",
        eventId: identifier,
        payload: rawBody,
        status: "pending",
      },
    });

    if (order && status === "paid" && order.status !== "paid") {
      const bot = new Telegraf(order.bot.token);
      await deliverPaidOrder({ prisma, bot, order });
      await prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });
    } else if (order && status !== "paid") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: status === "failed" ? "failed" : status === "cancelled" ? "cancelled" : "pending" },
      });
    }

    await prisma.webhookEvent.update({
      where: { source_eventId: eventKey },
      data: { status: "processed", error: null },
    });

    return NextResponse.json({ received: true, status });
  } catch (error) {
    console.error("Erro webhook SyncPay:", error);
    return NextResponse.json({ message: "Webhook SyncPay inválido ou não processado." }, { status: 500 });
  }
}
