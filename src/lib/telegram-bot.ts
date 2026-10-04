import { Telegraf } from "telegraf";
import { PrismaClient, Bot } from "@prisma/client";
import { generatePixQr } from "@/lib/pix-code";
import { createMercadoPagoPix, createAmploPayPix } from "@/lib/payment-gateways";
import { registerPurchaseActions } from "@/lib/telegram-purchase.js";
import { registerStartMenu } from "@/lib/telegram-start.js";
import { deliverPaidOrder } from "@/lib/product-delivery.js";

const prisma = new PrismaClient();
const botInstances = new Map<string, Telegraf>();

export function getBot(botRecord: Bot): Telegraf {
  if (botInstances.has(botRecord.id)) {
    return botInstances.get(botRecord.id)!;
  }

  const bot = new Telegraf(botRecord.token);
  registerPurchaseActions(bot, botRecord, prisma);

  registerStartMenu(bot, botRecord, prisma);

  // Ação de Compra
  bot.action(/^legacy_buy_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    try {
      const product = await prisma.product.findUnique({ 
        where: { id: productId },
        include: { bot: { include: { workspace: true } } }
      });
      if (!product) return ctx.answerCbQuery("Produto não encontrado.");

      await ctx.answerCbQuery("Gerando seu PIX...");
      await ctx.reply("⏳ Aguarde, gerando seu código PIX...");

      const orderId = `order_${Date.now()}_${ctx.from.id}`;

      // Garante que o usuário existe no BD
      await prisma.telegramUser.upsert({
        where: { id_botId: { id: ctx.from.id.toString(), botId: product.botId } },
        update: {
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
        },
        create: {
          id: ctx.from.id.toString(),
          botId: product.botId,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
        }
      });

      if (product.bot.paymentMethod === "pix_direto") {
        if (!product.bot.pixKey) {
          return ctx.reply("❌ O administrador do bot ainda não configurou a Chave PIX.");
        }

        const { copyPasteCode, qrCode } = await generatePixQr({
          pixKey: product.bot.pixKey,
          merchantName: product.bot.name,
          merchantCity: process.env.PIX_MERCHANT_CITY || "SAO PAULO",
          amount: product.price,
          transactionId: orderId,
        });
        
        await prisma.order.create({
          data: {
            id: orderId,
            botId: product.botId,
            productId: product.id,
            telegramUserId: ctx.from.id.toString(),
            status: "pending",
            amount: product.price,
            paymentGateway: "pix_direto"
          }
        });

        const amountLabel = product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        await ctx.replyWithPhoto(
          { source: qrCode, filename: "pix.png" },
          { caption: `Pix de ${amountLabel} para ${product.bot.name}. Chave: ${product.bot.pixKey}` }
        );
        await ctx.reply(`Pix copia e cola (${amountLabel}):\n${copyPasteCode}`);

        return ctx.reply("Depois de pagar, envie o comprovante como foto nesta conversa. O acesso será liberado após a aprovação do administrador.");
      }

      // Caso Mercado Pago
      if (product.bot.paymentMethod === "mercadopago") {
        const mpAccessToken = product.bot.mpAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!mpAccessToken || mpAccessToken === "seu_access_token_aqui") {
          return ctx.reply("❌ O administrador do bot ainda não configurou o Mercado Pago.");
        }

        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const webhookUrl = `${baseUrl}/api/webhooks/mercadopago`;

        let paymentData;
        try {
          paymentData = await createMercadoPagoPix({
            accessToken: mpAccessToken,
            orderId,
            amount: product.price,
            description: product.name,
            notificationUrl: webhookUrl,
            payerEmail: `tg_${ctx.from.id}@botmaker.local`,
            payerName: ctx.from.first_name || "Cliente Telegram",
          });
        } catch (error) {
          console.error("Mercado Pago Pix error:", error);
          return ctx.reply("❌ Não foi possível gerar o Pix no Mercado Pago. Confira o token e a conta cadastrada.");
        }
        
        await prisma.order.create({
          data: {
            id: orderId,
            botId: product.botId,
            productId: product.id,
            telegramUserId: ctx.from.id.toString(),
            status: "pending",
            amount: product.price,
            paymentId: paymentData.paymentId,
            paymentQrCode: paymentData.pixCode,
            paymentTicketUrl: paymentData.ticketUrl,
            paymentGateway: "mercadopago"
          }
        });

        const amountLabel = product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        if (paymentData.qrCodeBase64) {
          await ctx.replyWithPhoto(Buffer.from(paymentData.qrCodeBase64, "base64"), {
            caption: `Pix de ${amountLabel} para ${product.name}.`,
          });
        }
        await ctx.reply(`Pix copia e cola (${amountLabel}):\n${paymentData.pixCode}`);
        return;
      }

      // Caso Amplo Pay
      if (product.bot.paymentMethod === "amplopay") {
        const clientId = product.bot.amploPayClientId || process.env.AMPLOPAY_CLIENT_ID;
        const clientSecret = product.bot.amploPayClientSecret || process.env.AMPLOPAY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          return ctx.reply("❌ O administrador do bot ainda não configurou as chaves da Amplo Pay.");
        }

        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const webhookUrl = `${baseUrl}/api/webhooks/amplopay`;

        function randomCpf() {
          const r = () => Math.floor(Math.random() * 9);
          const n = Array(9).fill(0).map(r);
          let d1 = n.reduce((acc, val, i) => acc + val * (10 - i), 0);
          d1 = 11 - (d1 % 11);
          if (d1 >= 10) d1 = 0;
          n.push(d1);
          let d2 = n.reduce((acc, val, i) => acc + val * (11 - i), 0);
          d2 = 11 - (d2 % 11);
          if (d2 >= 10) d2 = 0;
          n.push(d2);
          return n.join('');
        }

        const payload = {
          identifier: orderId,
          amount: product.price,
          client: {
            name: ctx.from.first_name || "Cliente Telegram",
            email: `tg_${ctx.from.id}@telegram.local`,
            phone: "11999999999",
            document: randomCpf()
          },
          products: [{ id: product.id, name: product.name, quantity: 1, price: product.price }],
          metadata: { productId: product.id, telegramUserId: ctx.from.id.toString(), botId: botRecord.id },
          callbackUrl: webhookUrl
        };

        let paymentData;
        try {
          paymentData = await createAmploPayPix({ clientId, clientSecret, payload });
        } catch (error) {
          console.error("AmploPay Pix error:", error);
          return ctx.reply("❌ Não foi possível gerar o Pix na AmploPay. Confira as credenciais cadastradas.");
        }

        await prisma.order.create({
          data: {
            id: orderId,
            botId: product.botId,
            productId: product.id,
            telegramUserId: ctx.from.id.toString(),
            status: "pending",
            amount: product.price,
            paymentId: paymentData.paymentId || undefined,
            paymentQrCode: paymentData.pixCode,
            paymentGateway: "amplopay"
          }
        });

        const amountLabel = product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        await ctx.reply(`Pix copia e cola AmploPay (${amountLabel}):\n${paymentData.pixCode}`);
        return;
      }

    } catch (err) {
      console.error(err);
      ctx.reply("❌ Ocorreu um erro interno.");
    }
  });

  bot.action(/^pix_review_(approve|reject)_(.+)$/, async (ctx) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: ctx.match[2] },
        include: {
          bot: true,
          product: { include: { deliveries: true } },
          bumpProduct: { include: { deliveries: true } },
        },
      });
      const chatId = String(ctx.chat?.id || "");

      if (!order || !order.bot.pixReviewChatId || order.bot.pixReviewChatId !== chatId) {
        return ctx.answerCbQuery("Este grupo não está autorizado para revisar comprovantes.", { show_alert: true });
      }

      const administrators = await ctx.telegram.getChatAdministrators(chatId);
      if (!administrators.some((member) => member.user.id === ctx.from.id)) {
        return ctx.answerCbQuery("Somente administradores do grupo podem revisar pagamentos.", { show_alert: true });
      }
      if (order.status !== "review" || order.paymentGateway !== "pix_direto") {
        return ctx.answerCbQuery("Este comprovante já foi processado.", { show_alert: true });
      }

      const action = ctx.match[1];
      if (action === "reject") {
        const result = await prisma.order.updateMany({
          where: { id: order.id, status: "review" },
          data: { status: "cancelled" },
        });
        if (!result.count) return ctx.answerCbQuery("Este comprovante já foi processado.");

        await ctx.telegram.sendMessage(order.telegramUserId, "O comprovante do seu Pix não foi aprovado. Entre em contato com o vendedor para verificar o pagamento.");
        await ctx.answerCbQuery("Pagamento recusado.");
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        return;
      }

      try {
        const approved = await deliverPaidOrder({ prisma, bot, order });
        if (!approved) return ctx.answerCbQuery("Este comprovante já foi processado.", { show_alert: true });
      } catch (error) {
        throw error;
      }

      await ctx.answerCbQuery("Pagamento aprovado e acesso enviado.");
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch (error) {
      console.error("Erro ao revisar comprovante Pix:", error);
      await ctx.answerCbQuery("Não foi possível processar a revisão.", { show_alert: true });
    }
  });

  // Ação de Simular Pagamento (Teste Local)
  bot.action(/^simulate_pay_(.+)_(.+)$/, async (ctx) => {
    // mantido para retrocompatibilidade em dev
    await ctx.reply("Teste local finalizado. Verifique webhook.");
  });

  // Recebimento de Comprovantes (Pix Direto)
  bot.on('photo', async (ctx) => {
    try {
      const pendingOrder = await prisma.order.findFirst({
        where: {
          telegramUserId: ctx.from.id.toString(),
          botId: botRecord.id,
          status: "pending",
          paymentGateway: "pix_direto"
        },
        include: { product: true, bot: true }
      });

      if (!pendingOrder) return;

      const photo = ctx.message.photo[ctx.message.photo.length - 1]; 
      const fileId = photo.file_id;

      await prisma.order.update({
        where: { id: pendingOrder.id },
        data: {
          receiptUrl: fileId,
          status: "review" 
        }
      });

      if (pendingOrder.bot.pixReviewChatId) {
        const amountLabel = pendingOrder.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        await ctx.telegram.sendPhoto(pendingOrder.bot.pixReviewChatId, fileId, {
          caption: `Comprovante Pix para revisar\nPedido: ${pendingOrder.id}\nCliente: ${ctx.from.first_name || "Cliente"} (@${ctx.from.username || "sem usuário"})\nProduto: ${pendingOrder.product.name}\nValor: ${amountLabel}`,
          reply_markup: {
            inline_keyboard: [[
              { text: "Aprovar", callback_data: `pix_review_approve_${pendingOrder.id}` },
              { text: "Recusar", callback_data: `pix_review_reject_${pendingOrder.id}` },
            ]],
          },
        });
        await ctx.reply("✅ Comprovante recebido e enviado para revisão no grupo.");
      } else {
        await ctx.reply("✅ Comprovante salvo. O administrador ainda precisa configurar o grupo de revisão do Pix.");
      }
      
    } catch (err) {
      console.error(err);
    }
  });

  botInstances.set(botRecord.id, bot);
  return bot;
}
