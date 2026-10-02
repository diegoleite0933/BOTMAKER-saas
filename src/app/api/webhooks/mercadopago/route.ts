import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";
import { deliverPaidOrder } from "@/lib/product-delivery.js";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json();

    // O Mercado Pago envia o ID do pagamento no query param data.id ou no body.data.id
    const paymentId = url.searchParams.get('data.id') || body?.data?.id;

    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

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
    const mpAccessToken = order.bot.mpAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;
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
    const status = paymentInfo.status; // "approved", "pending", etc.

    // Salvar webhook
    await prisma.webhookEvent.create({
      data: {
        source: "mercadopago",
        eventId: paymentId.toString(),
        payload: JSON.stringify(body),
        status: status === "approved" ? "processed" : "pending"
      }
    });

    if (status === "approved") {
      const bot = new Telegraf(order.bot.token);
      await deliverPaidOrder({ prisma, bot, order });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erro webhook MP:", error);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}
