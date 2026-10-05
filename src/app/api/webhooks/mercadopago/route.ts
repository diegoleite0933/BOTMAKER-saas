import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";
import { deliverPaidOrder } from "@/lib/product-delivery.js";
import { resolvePaymentCredentials } from "@/lib/payment-credentials.js";

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
    const { accessToken: mpAccessToken } = await resolvePaymentCredentials(prisma, order.bot, "mercadopago");
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

    const eventKey = { source: "mercadopago", eventId: paymentId.toString() };
    await prisma.webhookEvent.upsert({
      where: { source_eventId: eventKey },
      create: { ...eventKey, payload: JSON.stringify(body), status: "pending" },
      update: { payload: JSON.stringify(body), status: "pending", error: null },
    });

    if (status === "approved") {
      if (order.status !== "paid") {
        const bot = new Telegraf(order.bot.token);
        await deliverPaidOrder({ prisma, bot, order });
      }
    } else {
      const statusByPayment = {
        rejected: "failed",
        cancelled: "cancelled",
        canceled: "cancelled",
        refunded: "refunded",
        charged_back: "refunded",
      } as const;
      const orderStatus = statusByPayment[status as keyof typeof statusByPayment] || "pending";
      await prisma.order.updateMany({
        where: { id: order.id, status: { not: "paid" } },
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
