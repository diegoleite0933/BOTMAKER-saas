const { reconcilePaidOrder } = require("./product-delivery.js");

function formatPrice(amount) {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getSalePrice(product) {
  const discountPercent = Math.min(90, Math.max(0, product.discountPercent || 0));
  return Math.round(product.price * (1 - discountPercent / 100) * 100) / 100;
}

function registerStartMenu(bot, botRecord, prisma) {
  bot.start(async (ctx) => {
    try {
      const currentBot = await prisma.bot.findUnique({ where: { id: botRecord.id } });
      const pendingOrders = await prisma.order.findMany({
        where: {
          botId: botRecord.id,
          telegramUserId: ctx.from.id.toString(),
          status: { in: ["pending", "review"] },
          paymentGateway: { not: "pix_direto" },
        },
        include: {
          bot: true,
          product: { include: { deliveries: true } },
          bumpProduct: { include: { deliveries: true } },
        },
      });

      for (const order of pendingOrders) {
        try {
          await reconcilePaidOrder({ prisma, bot, order });
        } catch (error) {
          console.error("Erro ao reconciliar pedido pendente:", error);
        }
      }

      await prisma.telegramUser.upsert({
        where: { id_botId: { id: ctx.from.id.toString(), botId: botRecord.id } },
        update: {
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
          lastStartedAt: new Date(),
        },
        create: {
          id: ctx.from.id.toString(),
          botId: botRecord.id,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
          lastStartedAt: new Date(),
        },
      });

      const [savedWelcomeMedia, offers] = await Promise.all([
        prisma.welcomeMedia.findMany({ where: { botId: botRecord.id }, orderBy: { position: "asc" } }),
        prisma.product.findMany({
          where: { botId: botRecord.id, status: "active", isOrderBumpOnly: false },
          include: { deliveries: { take: 1, select: { type: true } } },
        }),
      ]);

      const accessAvailable = offers.some((product) => ["group", "channel"].includes(product.deliveries[0]?.type));
      const productsAvailable = offers.some((product) => product.deliveries[0]?.type === "file");
      const keyboard = [];
      if (accessAvailable) keyboard.push([{ text: "Ver acessos", callback_data: "catalog_access" }]);
      if (productsAvailable) keyboard.push([{ text: "Ver produtos", callback_data: "catalog_product" }]);
      const replyOptions = keyboard.length ? { reply_markup: { inline_keyboard: keyboard } } : {};
      const message = currentBot?.welcomeMessage?.trim() || "Bem-vindo! Confira as opções disponíveis abaixo.";
      const welcomeMedia = savedWelcomeMedia.length
        ? savedWelcomeMedia
        : currentBot?.welcomeMediaId && currentBot.welcomeMediaType
          ? [{ fileId: currentBot.welcomeMediaId, mediaType: currentBot.welcomeMediaType }]
          : [];

      if (welcomeMedia.length === 1) {
        try {
          if (welcomeMedia[0].mediaType === "video") await ctx.replyWithVideo(welcomeMedia[0].fileId);
          else await ctx.replyWithPhoto(welcomeMedia[0].fileId);
        } catch (mediaError) {
          console.error("Erro ao enviar mídia de boas-vindas:", mediaError);
        }
      } else if (welcomeMedia.length > 1) {
        try {
          await ctx.replyWithMediaGroup(welcomeMedia.map((media) => ({
            type: media.mediaType === "video" ? "video" : "photo",
            media: media.fileId,
          })));
        } catch (mediaError) {
          console.error("Erro ao enviar mídias de boas-vindas:", mediaError);
        }
      }

      await ctx.reply(message, replyOptions);
    } catch (error) {
      console.error("Erro ao iniciar o bot:", error);
      await ctx.reply("Não foi possível carregar as opções agora. Tente novamente em instantes.");
    }
  });

  bot.action(/^catalog_(access|product)$/, async (ctx) => {
    const deliveryTypes = ctx.match[1] === "access" ? ["group", "channel"] : ["file"];
    const products = await prisma.product.findMany({
      where: {
        botId: botRecord.id,
        status: "active",
        isOrderBumpOnly: false,
        deliveries: { some: { type: { in: deliveryTypes } } },
      },
      include: { deliveries: { take: 1, select: { type: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!products.length) return ctx.answerCbQuery("Não há ofertas disponíveis nessa categoria.", { show_alert: true });

    await ctx.answerCbQuery();
    const buttons = products.map((product) => {
      const salePrice = getSalePrice(product);
      const priceLabel = product.discountPercent > 0
        ? `${formatPrice(salePrice)} (-${product.discountPercent}%)`
        : formatPrice(salePrice);
      return [{ text: `${product.name} · ${priceLabel}`, callback_data: `detail_${product.id}` }];
    });
    await ctx.reply("Escolha uma opção:", { reply_markup: { inline_keyboard: buttons } });
  });
}

module.exports = { registerStartMenu };