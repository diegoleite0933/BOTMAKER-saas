import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";

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
        where: { id: identifier }
      });

      if (order && order.status !== "paid") {
        // Atualiza para pago
        await prisma.order.update({
          where: { id: identifier },
          data: { status: "paid" }
        });

        // Buscar o produto e as configurações de entrega
        const product = await prisma.product.findUnique({
          where: { id: order.productId },
          include: { deliveries: true }
        });

        const botRecord = await prisma.bot.findUnique({
          where: { id: order.botId }
        });

        if (product && botRecord) {
          const bot = new Telegraf(botRecord.token);
          
          // Entregar o acesso
          const delivery = product.deliveries[0];
          if (delivery && delivery.type === 'group' && delivery.telegramChatId) {
            try {
              const inviteLink = await bot.telegram.createChatInviteLink(delivery.telegramChatId, {
                member_limit: 1, 
                expire_date: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
                name: `Acesso via Amplo Pay`
              });

              await bot.telegram.sendMessage(
                order.telegramUserId, 
                `🎉 *Pagamento Aprovado!*\n\nAqui está o seu acesso exclusivo:\n\n${inviteLink.invite_link}\n\nEste link só pode ser usado 1 vez.`,
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
    console.error("Erro no webhook Amplo Pay:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
