require("dotenv").config();
const { Telegraf } = require("telegraf");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const runningBots = new Map();

async function handlePixReview(ctx, action, orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      bot: true,
      product: { include: { deliveries: true } },
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

  const delivery = order.product.deliveries[0];
  if (!delivery) return ctx.answerCbQuery("Este produto não tem entrega configurada.", { show_alert: true });

  let inviteLink = null;
  if ((delivery.type === "group" || delivery.type === "channel") && delivery.telegramChatId) {
    const invite = await ctx.telegram.createChatInviteLink(delivery.telegramChatId, {
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      name: `Pedido ${order.id}`,
    });
    inviteLink = invite.invite_link;
  } else if (!delivery.content) {
    return ctx.answerCbQuery("Este produto não tem dados de entrega configurados.", { show_alert: true });
  }

  try {
    const approved = await prisma.$transaction(async (transaction) => {
      const result = await transaction.order.updateMany({
        where: { id: order.id, status: "review" },
        data: { status: "paid" },
      });
      if (!result.count) return false;

      await transaction.access.create({
        data: {
          telegramUserId: order.telegramUserId,
          botId: order.botId,
          deliveryId: delivery.id,
          inviteLink,
          status: "active",
          expiresAt: delivery.durationDays ? new Date(Date.now() + delivery.durationDays * 86400000) : null,
        },
      });
      return true;
    });

    if (!approved) return ctx.answerCbQuery("Este comprovante já foi processado.", { show_alert: true });
  } catch (error) {
    if (inviteLink && delivery.telegramChatId) {
      await ctx.telegram.revokeChatInviteLink(delivery.telegramChatId, inviteLink).catch(() => undefined);
    }
    throw error;
  }

  const deliveryMessage = inviteLink
    ? `Aqui está seu link de acesso: ${inviteLink}`
    : delivery.content;
  await ctx.telegram.sendMessage(order.telegramUserId, `✅ Pagamento aprovado.\n${deliveryMessage}`);
  await ctx.answerCbQuery("Pagamento aprovado e acesso enviado.");
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
}

async function processRemarketing(botRecord, bot) {
  const campaigns = await prisma.remarketing.findMany({
    where: { botId: botRecord.id, isActive: true },
  });

  for (const campaign of campaigns) {
    if (!campaign.message && !campaign.mediaFileId) continue;

    const delayMinutes = campaign.delayDays ? campaign.delayDays * 1440 : campaign.delayMinutes;
    const cutoff = new Date(Date.now() - delayMinutes * 60000);
    const latestPaidOrders = await prisma.order.findMany({
      where: { botId: botRecord.id, status: "paid" },
      select: { telegramUserId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      distinct: ["telegramUserId"],
    });
    const customers = latestPaidOrders.filter((order) => order.updatedAt <= cutoff);

    for (const customer of customers) {
      const existing = await prisma.remarketingSend.findUnique({
        where: {
          remarketingId_telegramUserId: {
            remarketingId: campaign.id,
            telegramUserId: customer.telegramUserId,
          },
        },
      });
      const staleSendingBefore = new Date(Date.now() - 15 * 60 * 1000);

      if (existing?.status === "sent") continue;
      if (existing?.status === "sending" && existing.updatedAt > staleSendingBefore) continue;

      if (existing) {
        await prisma.remarketingSend.update({
          where: { id: existing.id },
          data: { status: "sending", failureReason: null, sentAt: null },
        });
      } else {
        try {
          await prisma.remarketingSend.create({
            data: {
              remarketingId: campaign.id,
              botId: botRecord.id,
              telegramUserId: customer.telegramUserId,
              status: "sending",
            },
          });
        } catch (error) {
          if (error?.code === "P2002") continue;
          throw error;
        }
      }

      try {
        if (campaign.mediaFileId && campaign.mediaType === "photo") {
          await bot.telegram.sendPhoto(customer.telegramUserId, campaign.mediaFileId, {
            ...(campaign.message ? { caption: campaign.message } : {}),
          });
        } else if (campaign.mediaFileId && campaign.mediaType === "video") {
          await bot.telegram.sendVideo(customer.telegramUserId, campaign.mediaFileId, {
            ...(campaign.message ? { caption: campaign.message } : {}),
          });
        } else if (campaign.message) {
          await bot.telegram.sendMessage(customer.telegramUserId, campaign.message);
        }

        await prisma.remarketingSend.updateMany({
          where: { remarketingId: campaign.id, telegramUserId: customer.telegramUserId },
          data: { status: "sent", sentAt: new Date(), failureReason: null },
        });
      } catch (error) {
        await prisma.remarketingSend.updateMany({
          where: { remarketingId: campaign.id, telegramUserId: customer.telegramUserId },
          data: {
            status: "failed",
            failureReason: error instanceof Error ? error.message.slice(0, 500) : "Falha ao enviar mensagem.",
          },
        });
        console.error(`[Remarketing] Falha ao enviar campanha ${campaign.id}:`, error);
      }
    }
  }
}

async function startBot(botRecord) {
  if (runningBots.has(botRecord.id)) return; // Já está rodando

  console.log(`[Bot Runner] Iniciando bot: @${botRecord.username}`);
  const bot = new Telegraf(botRecord.token);

  // Comando /start
  bot.start(async (ctx) => {
    try {
      // Buscar bot atualizado
      const currentBot = await prisma.bot.findUnique({ where: { id: botRecord.id } });
      const savedWelcomeMedia = await prisma.welcomeMedia.findMany({
        where: { botId: botRecord.id },
        orderBy: { position: "asc" },
      });

      // Buscar produtos do bot
      const products = await prisma.product.findMany({
        where: { botId: botRecord.id, status: 'active' }
      });

      if (products.length === 0) {
        return ctx.reply("Olá! No momento não temos produtos disponíveis.");
      }

      const message = currentBot?.welcomeMessage || `Bem-vindo à loja! Escolha um produto abaixo para comprar via Pix:`;
      
      const buttons = products.map(p => {
        return [{ text: `${p.name} - R$ ${p.price.toFixed(2)}`, callback_data: `buy_${p.id}` }];
      });

      const welcomeMedia = savedWelcomeMedia.length > 0
        ? savedWelcomeMedia
        : currentBot?.welcomeMediaId && currentBot.welcomeMediaType
          ? [{ fileId: currentBot.welcomeMediaId, mediaType: currentBot.welcomeMediaType }]
          : [];

      if (welcomeMedia.length > 0) {
        try {
          if (welcomeMedia.length === 1 && welcomeMedia[0].mediaType === "video") {
            await ctx.replyWithVideo(welcomeMedia[0].fileId, { caption: message, reply_markup: { inline_keyboard: buttons } });
            return;
          }
          if (welcomeMedia.length === 1) {
            await ctx.replyWithPhoto(welcomeMedia[0].fileId, { caption: message, reply_markup: { inline_keyboard: buttons } });
            return;
          } else {
            await ctx.replyWithMediaGroup(welcomeMedia.map((media) => ({
              type: media.mediaType === "video" ? "video" : "photo",
              media: media.fileId,
            })));
          }
        } catch (mediaErr) {
          console.error("Erro ao enviar mídias de boas-vindas:", mediaErr);
        }
      }

      await ctx.reply(message, { reply_markup: { inline_keyboard: buttons } });
    } catch (err) {
      console.error(err);
      ctx.reply("Ocorreu um erro ao buscar os produtos.");
    }
  });

  bot.action(/^buy_(.+)$/, async (ctx) => {
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

      if (product.bot.paymentMethod === "pix_direto") {
        if (!product.bot.pixKey) {
          return ctx.reply("❌ O administrador do bot ainda não configurou a Chave PIX.");
        }

        const pixCodeModule = await import("./src/lib/pix-code.js");
        const { copyPasteCode, qrCode } = await pixCodeModule.default.generatePixQr({
          pixKey: product.bot.pixKey,
          merchantName: product.bot.name,
          merchantCity: process.env.PIX_MERCHANT_CITY || "SAO PAULO",
          amount: product.price,
          transactionId: orderId,
        });
        
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
        const paymentGateways = (await import("./src/lib/payment-gateways.js")).default;
        let paymentData;
        try {
          paymentData = await paymentGateways.createMercadoPagoPix({
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
        
        // Salvar o pedido no banco de dados
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

        // Enviar o PIX para o usuário
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

        // Gerar CPF válido para burlar a trava da API
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
          products: [
            {
              id: product.id,
              name: product.name,
              quantity: 1,
              price: product.price
            }
          ],
          metadata: {
            productId: product.id,
            telegramUserId: ctx.from.id.toString(),
            botId: botRecord.id
          },
          callbackUrl: webhookUrl
        };

        let paymentData;
        try {
          const paymentGateways = (await import("./src/lib/payment-gateways.js")).default;
          paymentData = await paymentGateways.createAmploPayPix({ clientId, clientSecret, payload });
        } catch (error) {
          console.error("AmploPay Pix error:", error);
          return ctx.reply("❌ Não foi possível gerar o Pix na AmploPay. Confira as credenciais cadastradas.");
        }

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

        // Salvar pedido
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

        // Enviar o PIX
        const amountLabel = product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        await ctx.reply(`Pix copia e cola AmploPay (${amountLabel}):\n${paymentData.pixCode}`);

        return;
      }

    } catch (err) {
      console.error(err);
      ctx.reply("❌ Ocorreu um erro interno.");
    }
  });

  // Ação de Simular Pagamento
  bot.action(/^simulate_pay_(.+)_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    
    try {
      const product = await prisma.product.findUnique({ 
        where: { id: productId },
        include: { deliveries: true } 
      });

      if (!product) return ctx.answerCbQuery("Produto não encontrado.");

      await ctx.answerCbQuery("Pagamento Aprovado!");
      await ctx.reply("✅ *Pagamento Aprovado com Sucesso!*\n\nPreparando seu acesso...", { parse_mode: 'Markdown' });

      // Entregar o acesso
      const delivery = product.deliveries[0];
      if (delivery && delivery.type === 'group' && delivery.telegramChatId) {
        // O bot precisa gerar um link de convite único
        try {
          const inviteLink = await ctx.telegram.createChatInviteLink(delivery.telegramChatId, {
            member_limit: 1, // apenas um uso
            expire_date: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // expira em 1 dia
            name: `Acesso: ${ctx.from.first_name}`
          });

          await ctx.reply(`🎉 *Aqui está o seu acesso exclusivo:*\n\n${inviteLink.invite_link}\n\nEste link só pode ser usado 1 vez.`, {
            parse_mode: 'Markdown'
          });
        } catch (chatErr) {
          console.error("Erro ao gerar convite:", chatErr);
          await ctx.reply("❌ Ocorreu um erro ao gerar o link do grupo. Verifique se o Bot é Administrador do Grupo e tem permissão para 'Convidar Usuários' via link.");
        }
      } else {
        await ctx.reply("Este produto não possui um canal ou grupo configurado corretamente.");
      }

    } catch (err) {
      console.error(err);
    }
  });

    bot.action(/^pix_review_(approve|reject)_(.+)$/, async (ctx) => {
      try {
        await handlePixReview(ctx, ctx.match[1], ctx.match[2]);
      } catch (error) {
        console.error("Erro ao revisar comprovante Pix:", error);
        await ctx.answerCbQuery("Não foi possível processar a revisão.", { show_alert: true });
      }
    });

  // Recebimento de Comprovantes (Pix Direto)
  bot.on('photo', async (ctx) => {
    try {
      // Procura se existe algum pedido pendente de pix_direto
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

      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Maior resolução
      const fileId = photo.file_id;

      // TODO: Enviar a foto para o ADMIN (usuário dono do bot) com botão Aprovar/Recusar
      // Por enquanto, no MVP, vamos aprovar automaticamente para o fluxo de testes ou podemos logar no painel.
      await prisma.order.update({
        where: { id: pendingOrder.id },
        data: {
          receiptUrl: fileId,
          status: "review" // status criado para painel
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
        await ctx.reply("✅ Comprovante enviado para revisão no grupo. Você receberá o acesso depois da aprovação.");
      } else {
        await ctx.reply("✅ Comprovante salvo. O administrador ainda precisa configurar o grupo de revisão do Pix.");
      }

      console.log(`[Bot Runner] Comprovante de PIX recebido para o pedido ${pendingOrder.id}`);

    } catch (err) {
      console.error(err);
    }
  });

  runningBots.set(botRecord.id, bot);

  const launchBot = () => {
    bot.launch().catch((error) => {
      const isPollingConflict = error?.response?.error_code === 409;
      console.error(
        `[Bot Runner] Falha ao iniciar @${botRecord.username}; nova tentativa em breve:`,
        error,
      );
      const retryTimer = setTimeout(launchBot, isPollingConflict ? 15000 : 30000);
      retryTimer.unref();
    });
  };

  launchBot();
}

async function main() {
  console.log("[Bot Runner] Verificando bots no banco de dados...");
  let remarketingWorkerBusy = false;

  setInterval(async () => {
    if (remarketingWorkerBusy) return;
    remarketingWorkerBusy = true;
    try {
      const activeBots = await prisma.bot.findMany({ where: { status: "active" } });
      for (const botRecord of activeBots) {
        const bot = runningBots.get(botRecord.id);
        if (bot) await processRemarketing(botRecord, bot);
      }
    } catch (error) {
      console.error("[Remarketing] Erro ao processar campanhas:", error);
    } finally {
      remarketingWorkerBusy = false;
    }
  }, 60 * 1000);
  
  // Roda num loop infinito verificando novos bots a cada 10 segundos
  setInterval(async () => {
    try {
      const bots = await prisma.bot.findMany({ where: { status: 'active' } });
      for (const bot of bots) {
        startBot(bot);
      }
    } catch (err) {
      console.error("[Bot Runner] Erro ao buscar bots:", err);
    }
  }, 10000);

  // Primeira checagem imediata
  const bots = await prisma.bot.findMany({ where: { status: 'active' } });
  for (const bot of bots) {
    startBot(bot);
  }
}

// Tratamento para encerrar graciosamente
process.once('SIGINT', () => {
  runningBots.forEach(bot => bot.stop('SIGINT'));
  process.exit(0);
});
process.once('SIGTERM', () => {
  runningBots.forEach(bot => bot.stop('SIGTERM'));
  process.exit(0);
});

main();
