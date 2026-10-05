import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";
import { deliverPaidOrder } from "@/lib/product-delivery.js";
import { verifyPaymentWebhookSignature } from "@/lib/payment-service.js";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { identifier, status } = body;
    if (typeof identifier !== "string" || !identifier) {
      return NextResponse.json({ message: "Identificador do pedido ausente." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: identifier },
      include: {
        bot: true,
        product: { include: { deliveries: true } },
        bumpProduct: { include: { deliveries: true } },
      },
    });
    if (!order) return NextResponse.json({ message: "Pedido não encontrado." }, { status: 404 });

    const signature = new URL(req.url).searchParams.get("signature");
    if (order.webhookSignature && signature !== order.webhookSignature) {
      return NextResponse.json({ message: "Assinatura de webhook inválida." }, { status: 401 });
    }
    if (!order.webhookSignature && signature && !verifyPaymentWebhookSignature(identifier, signature)) {
      return NextResponse.json({ message: "Assinatura de webhook inválida." }, { status: 401 });
    }

    const eventKey = { source: "amplopay", eventId: identifier };
    await prisma.webhookEvent.upsert({
      where: { source_eventId: eventKey },
      create: { ...eventKey, payload: JSON.stringify(body), status: "pending" },
      update: { payload: JSON.stringify(body), status: "pending", error: null },
    });

    if (status === "COMPLETED") {
      if (order.status !== "paid") {
        const bot = new Telegraf(order.bot.token);
        await deliverPaidOrder({ prisma, bot, order });
      }
    }

    await prisma.webhookEvent.update({
      where: { source_eventId: eventKey },
      data: { status: status === "COMPLETED" ? "processed" : "pending", error: null },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erro no webhook Amplo Pay:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
