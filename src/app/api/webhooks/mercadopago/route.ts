import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";

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
      include: { bot: true },
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
      // Usar o paymentId para achar o pedido (salvamos como paymentId)
      if (order.status !== "paid") {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "paid" }
        });

        const product = await prisma.product.findUnique({
          where: { id: order.productId },
          include: { deliveries: true }
        });

        const botRecord = await prisma.bot.findUnique({
          where: { id: order.botId }
        });

        if (product && botRecord) {
          const bot = new Telegraf(botRecord.token);
          
          const delivery = product.deliveries[0];
          if (delivery && delivery.type === 'group' && delivery.telegramChatId) {
            try {
              const inviteLink = await bot.telegram.createChatInviteLink(delivery.telegramChatId, {
                member_limit: 1, 
                expire_date: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
                name: `Acesso MP`
              });

              await bot.telegram.sendMessage(
                order.telegramUserId, 
                `🎉 *Pagamento Aprovado!*\n\nAqui está o seu acesso:\n\n${inviteLink.invite_link}`,
                { parse_mode: 'Markdown' }
              );
            } catch (err) {
              console.error("Erro na entrega via webhook:", err);
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erro webhook MP:", error);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}
