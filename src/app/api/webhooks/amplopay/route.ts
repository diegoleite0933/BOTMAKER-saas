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
    const validSignature = order.webhookSignature
      ? signature === order.webhookSignature
      : verifyPaymentWebhookSignature(identifier, signature || "");
    if (!validSignature) {
      return NextResponse.json({ message: "Assinatura de webhook inválida." }, { status: 401 });
    }

    const normalizedStatus = typeof status === "string" ? status.trim().toUpperCase() : "";
    const eventKey = { source: "amplopay", eventId: `${identifier}:${normalizedStatus || "UNKNOWN"}` };
    await prisma.webhookEvent.upsert({
      where: { source_eventId: eventKey },
      create: { ...eventKey, payload: JSON.stringify(body), status: "pending" },
      update: { payload: JSON.stringify(body), status: "pending", error: null },
    });

    if (["COMPLETED", "APPROVED", "PAID"].includes(normalizedStatus)) {
      if (!["paid", "refunded"].includes(order.status)) {
        const bot = new Telegraf(order.bot.token);
        await deliverPaidOrder({ prisma, bot, order });
      }
    } else if (["REFUNDED", "CHARGED_BACK"].includes(normalizedStatus)) {
      await prisma.order.updateMany({
        where: { id: order.id, status: "paid" },
        data: { status: "refunded" },
      });
    }

    await prisma.webhookEvent.update({
      where: { source_eventId: eventKey },
      data: { status: ["COMPLETED", "APPROVED", "PAID", "REFUNDED", "CHARGED_BACK"].includes(normalizedStatus) ? "processed" : "pending", error: null },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erro no webhook Amplo Pay:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
