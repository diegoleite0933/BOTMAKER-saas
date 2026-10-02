function currency(amount) {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function showMedia(ctx, product) {
  if (!product.telegramMediaId) return;
  if (product.telegramMediaType === "video") {
    await ctx.replyWithVideo(product.telegramMediaId);
  } else {
    await ctx.replyWithPhoto(product.telegramMediaId);
  }
}

async function loadProduct(prisma, botId, productId) {
  return prisma.product.findFirst({
    where: { id: productId, botId, status: "active" },
  });
}

async function createTelegramCustomer(prisma, ctx, botId) {
  const id = ctx.from.id.toString();
  return prisma.telegramUser.upsert({
    where: { id_botId: { id, botId } },
    update: {
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username,
    },
    create: {
      id,
      botId,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username,
    },
  });
}

async function checkout(ctx, prisma, botRecord, product, bumpProduct) {
  const [pixModule, paymentModule] = await Promise.all([
    import("./pix-code.js"),
    import("./payment-gateways.js"),
  ]);
  const { generatePixQr } = pixModule.default || pixModule;
  const { createMercadoPagoPix, createAmploPayPix } = paymentModule.default || paymentModule;
  await createTelegramCustomer(prisma, ctx, product.botId);
  const total = product.price + (bumpProduct?.price || 0);
  const orderId = `order_${Date.now()}_${ctx.from.id}`;
  const productNames = bumpProduct ? `${product.name} + ${bumpProduct.name}` : product.name;
  const orderData = {
    id: orderId,
    botId: product.botId,
    productId: product.id,
    bumpProductId: bumpProduct?.id || null,
    telegramUserId: ctx.from.id.toString(),
    status: "pending",
    amount: total,
  };

  if (botRecord.paymentMethod === "pix_direto") {
    if (!botRecord.pixKey) return ctx.reply("O administrador ainda não configurou a chave PIX.");

    const { copyPasteCode, qrCode } = await generatePixQr({
      pixKey: botRecord.pixKey,
      merchantName: botRecord.name,
      merchantCity: process.env.PIX_MERCHANT_CITY || "SAO PAULO",
      amount: total,
      transactionId: orderId,
    });
    await prisma.order.create({ data: { ...orderData, paymentGateway: "pix_direto" } });
    await ctx.replyWithPhoto(
      { source: qrCode, filename: "pix.png" },
      { caption: `PIX de ${currency(total)} para ${productNames}. Chave: ${botRecord.pixKey}` },
    );
    await ctx.reply(`PIX copia e cola (${currency(total)}):\n${copyPasteCode}`);
    return ctx.reply("Depois de pagar, envie o comprovante como foto nesta conversa.");
  }

  if (botRecord.paymentMethod === "mercadopago") {
    const accessToken = botRecord.mpAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken || accessToken === "seu_access_token_aqui") {
      return ctx.reply("O administrador ainda não configurou o Mercado Pago.");
    }

    const payment = await createMercadoPagoPix({
      accessToken,
      orderId,
      amount: total,
      description: productNames,
      notificationUrl: `${process.env.APP_URL || "http://localhost:3000"}/api/webhooks/mercadopago`,
      payerEmail: `tg_${ctx.from.id}@botmaker.local`,
      payerName: ctx.from.first_name || "Cliente Telegram",
    });
    await prisma.order.create({
      data: {
        ...orderData,
        paymentGateway: "mercadopago",
        paymentId: payment.paymentId,
        paymentQrCode: payment.pixCode,
        paymentTicketUrl: payment.ticketUrl,
      },
    });
    if (payment.qrCodeBase64) {
      await ctx.replyWithPhoto(Buffer.from(payment.qrCodeBase64, "base64"), {
        caption: `PIX de ${currency(total)} para ${productNames}.`,
      });
    }
    return ctx.reply(`PIX copia e cola (${currency(total)}):\n${payment.pixCode}`);
  }

  if (botRecord.paymentMethod === "amplopay") {
    const clientId = botRecord.amploPayClientId || process.env.AMPLOPAY_CLIENT_ID;
    const clientSecret = botRecord.amploPayClientSecret || process.env.AMPLOPAY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return ctx.reply("O administrador ainda não configurou a AmploPay.");

    const products = [product, ...(bumpProduct ? [bumpProduct] : [])];
    const payload = {
      identifier: orderId,
      amount: total,
      client: {
        name: ctx.from.first_name || "Cliente Telegram",
        email: `tg_${ctx.from.id}@telegram.local`,
        phone: "11999999999",
        document: createCpf(),
      },
      products: products.map((entry) => ({ id: entry.id, name: entry.name, quantity: 1, price: entry.price })),
      metadata: { productId: product.id, bumpProductId: bumpProduct?.id || null, telegramUserId: ctx.from.id.toString(), botId: product.botId },
      callbackUrl: `${process.env.APP_URL || "http://localhost:3000"}/api/webhooks/amplopay`,
    };
    const payment = await createAmploPayPix({ clientId, clientSecret, payload });
    await prisma.order.create({
      data: { ...orderData, paymentGateway: "amplopay", paymentId: payment.paymentId || undefined, paymentQrCode: payment.pixCode },
    });
    return ctx.reply(`PIX copia e cola AmploPay (${currency(total)}):\n${payment.pixCode}`);
  }

  return ctx.reply("Forma de pagamento não configurada.");
}

function createCpf() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const addDigit = (values, weight) => {
    const sum = values.reduce((total, digit, index) => total + digit * (weight - index), 0);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  digits.push(addDigit(digits, 10));
  digits.push(addDigit(digits, 11));
  return digits.join("");
}

function registerPurchaseActions(bot, botRecord, prisma) {
  bot.action(/^(?:detail|buy)_(.+)$/, async (ctx) => {
    const product = await loadProduct(prisma, botRecord.id, ctx.match[1]);
    if (!product) return ctx.answerCbQuery("Produto indisponível.", { show_alert: true });
    await ctx.answerCbQuery();
    await showMedia(ctx, product).catch((error) => console.error("Falha ao exibir mídia do produto:", error));
    const description = product.description?.trim() || "Confira esta oferta e escolha como deseja continuar.";
    return ctx.reply(`${product.name}\n${currency(product.price)}\n\n${description}`, {
      reply_markup: { inline_keyboard: [[{ text: "Continuar para comprar", callback_data: `next_${product.id}` }]] },
    });
  });

  bot.action(/^next_(.+)$/, async (ctx) => {
    const product = await loadProduct(prisma, botRecord.id, ctx.match[1]);
    if (!product) return ctx.answerCbQuery("Produto indisponível.", { show_alert: true });
    await ctx.answerCbQuery();

    const bump = product.orderBumpProductId
      ? await loadProduct(prisma, product.botId, product.orderBumpProductId)
      : null;
    if (!bump) return checkout(ctx, prisma, botRecord, product, null);

    await showMedia(ctx, bump).catch((error) => console.error("Falha ao exibir mídia do order bump:", error));
    const description = bump.description?.trim() || "Oferta adicional exclusiva para este pedido.";
    return ctx.reply(`Produto principal: ${product.name} · ${currency(product.price)}\n\nOferta adicional: ${bump.name} · ${currency(bump.price)}\n${description}\n\nTotal com a oferta: ${currency(product.price + bump.price)}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `Adicionar por ${currency(bump.price)}`, callback_data: `b_${product.id}_${bump.id}` }],
          [{ text: "Não, continuar sem", callback_data: `n_${product.id}` }],
        ],
      },
    });
  });

  bot.action(/^n_(.+)$/, async (ctx) => {
    const product = await loadProduct(prisma, botRecord.id, ctx.match[1]);
    if (!product) return ctx.answerCbQuery("Produto indisponível.", { show_alert: true });
    await ctx.answerCbQuery("Continuando sem a oferta adicional.");
    return checkout(ctx, prisma, botRecord, product, null);
  });

  bot.action(/^b_(.+)_(.+)$/, async (ctx) => {
    const product = await loadProduct(prisma, botRecord.id, ctx.match[1]);
    if (!product || product.orderBumpProductId !== ctx.match[2]) {
      return ctx.answerCbQuery("Esta oferta não está mais disponível.", { show_alert: true });
    }
    const bump = await loadProduct(prisma, botRecord.id, ctx.match[2]);
    if (!bump) return ctx.answerCbQuery("A oferta adicional não está mais disponível.", { show_alert: true });
    await ctx.answerCbQuery("Oferta adicionada ao pedido.");
    return checkout(ctx, prisma, botRecord, product, bump);
  });
}

module.exports = { registerPurchaseActions };