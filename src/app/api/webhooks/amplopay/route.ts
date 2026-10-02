import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";
import { deliverPaidOrder } from "@/lib/product-delivery.js";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Verifique o status da transação
    // Amplo Pay manda o status no webhook
    const { identifier, status, metadata } = body;

    // Log the webhook
    await prisma.webhookEvent.create({
      data: {
        source: "amplopay",
        eventId: identifier || "unknown",
        payload: JSON.stringify(body),
        status: status === "COMPLETED" ? "processed" : "pending"
      }
    });

    if (status === "COMPLETED") {
      // Procurar o pedido
      const order = await prisma.order.findUnique({
        where: { id: identifier },
        include: {
          bot: true,
          product: { include: { deliveries: true } },
          bumpProduct: { include: { deliveries: true } },
        },
      });

      if (order && order.status !== "paid") {
        const bot = new Telegraf(order.bot.token);
        await deliverPaidOrder({ prisma, bot, order });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erro no webhook Amplo Pay:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
