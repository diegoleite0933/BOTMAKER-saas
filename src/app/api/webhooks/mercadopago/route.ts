import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";
import { deliverPaidOrder } from "@/lib/product-delivery.js";
import { resolvePaymentCredentials, resolvePlatformReceivingCredentials } from "@/lib/payment-credentials.js";
import { markPlatformFeeReceived, recordPlatformFeeRefund } from "@/lib/platform-fees.js";
import { verifyMercadoPagoWebhookSignature } from "@/lib/mercadopago-marketplace.js";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json();

    // O Mercado Pago envia o ID do pagamento no query param data.id ou no body.data.id
    const paymentId = url.searchParams.get('data.id') || body?.data?.id;

    if (!paymentId) return NextResponse.json({ received: true });

    const order = await prisma.order.findFirst({
      where: { paymentId: paymentId.toString() },
      include: {
        bot: true,
        product: { include: { deliveries: true } },
        bumpProduct: { include: { deliveries: true } },
      },
    });
    if (!order) {
      return NextResponse.json({ message: "Pedido ainda não encontrado" }, { status: 404 });
    }

    // Use the same bot-specific credential that created the payment.
    const credentials = await resolvePaymentCredentials(prisma, order.bot, "mercadopago");
    const platformCredentials = await resolvePlatformReceivingCredentials(prisma, "mercadopago");
    const webhookSecret = credentials.webhookSecret || platformCredentials?.webhookSecret || process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const signature = req.headers.get("x-signature");
    const requestId = req.headers.get("x-request-id");
    if (webhookSecret && !verifyMercadoPagoWebhookSignature({ signature, requestId, dataId: paymentId.toString(), secret: webhookSecret })) {
      return NextResponse.json({ message: "Assinatura Mercado Pago inválida." }, { status: 401 });
    }

    const mpAccessToken = credentials.accessToken;
    if (!mpAccessToken) {
      return NextResponse.json({ message: "Credencial do Mercado Pago não configurada" }, { status: 503 });
    }

    // Busca status no Mercado Pago
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`
      }
    });

    if (!paymentResponse.ok) {
      return NextResponse.json({ message: "Failed to fetch from MP" }, { status: 400 });
    }

    const paymentInfo = await paymentResponse.json();
    const status = paymentInfo.status;
    const amountMatches = Math.abs(Number(paymentInfo.transaction_amount) - order.amount) <= 0.01;
    if (String(paymentInfo.id) !== String(paymentId) || paymentInfo.currency_id !== "BRL" || !amountMatches) {
      return NextResponse.json({ message: "Os dados do pagamento não correspondem ao pedido." }, { status: 400 });
    }

    const eventKey = { source: "mercadopago", eventId: `${paymentId}:${String(status)}` };
    await prisma.webhookEvent.upsert({
      where: { source_eventId: eventKey },
      create: { ...eventKey, payload: JSON.stringify(body), status: "pending" },
      update: { payload: JSON.stringify(body), status: "pending", error: null },
    });

    if (status === "approved") {
      const applicationFeeCents = Number.isFinite(Number(paymentInfo.application_fee))
        ? Math.round(Number(paymentInfo.application_fee) * 100)
        : null;
      const splitConfirmed = order.platformFeeSplitRequested === true && applicationFeeCents === 30;
      if (!["paid", "refunded"].includes(order.status)) {
        const bot = new Telegraf(order.bot.token);
        await deliverPaidOrder({
          prisma,
          bot,
          order,
          splitConfirmed,
          splitReference: splitConfirmed ? String(paymentInfo.id) : null,
        });
      } else if (order.status === "paid" && splitConfirmed) {
        const result = await prisma.$transaction((transaction) => markPlatformFeeReceived(transaction, order, {
          confirmedAmountCents: applicationFeeCents,
          providerReference: String(paymentInfo.id),
        }));
        if (result.received) {
          console.info(`[PLATFORM_FEE] tenant=${order.bot.workspaceId} gateway=mercadopago transaction=${paymentInfo.id} sale=${order.id} fee=30 status=RECEIVED`);
        }
      }
    } else if (status === "refunded" || status === "charged_back") {
      const result = await prisma.$transaction(async (transaction) => {
        await transaction.order.updateMany({ where: { id: order.id, status: "paid" }, data: { status: "refunded" } });
        return recordPlatformFeeRefund(transaction, order, { refundReference: String(paymentInfo.id) });
      });
      if (result.created) {
        console.info(`[PLATFORM_FEE] tenant=${order.bot.workspaceId} gateway=mercadopago transaction=${paymentInfo.id} sale=${order.id} fee=${result.amountCents} status=REFUND_ADJUSTMENT`);
      }
    } else {
      const statusByPayment = {
        rejected: "failed",
        cancelled: "cancelled",
        canceled: "cancelled",
      } as const;
      const orderStatus = statusByPayment[status as keyof typeof statusByPayment] || "pending";
      await prisma.order.updateMany({
        where: { id: order.id, status: { in: ["pending", "review"] } },
        data: { status: orderStatus },
      });
    }

    await prisma.webhookEvent.update({ where: { source_eventId: eventKey }, data: { status: "processed", error: null } });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erro webhook MP:", error);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}
