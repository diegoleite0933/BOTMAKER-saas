async function buildDeliveryEntries({ bot, order, product, inviteLinkMap = new Map() }) {
  const productDeliveries = Array.isArray(product?.deliveries) ? product.deliveries : [];
  if (!productDeliveries.length) {
    throw new Error(`Produto sem entrega configurada: ${product.name}`);
  }

  const entries = [];
  for (const delivery of productDeliveries) {
    if (!delivery) continue;

    let inviteLink = inviteLinkMap.get(delivery.id) || null;
    if (!inviteLink && (delivery.type === "group" || delivery.type === "channel")) {
      if (!delivery.telegramChatId) {
        throw new Error(`Produto sem grupo/canal de entrega: ${product.name}`);
      }
      const invite = await bot.telegram.createChatInviteLink(delivery.telegramChatId, {
        member_limit: 1,
        expire_date: Math.floor(Date.now() / 1000) + 86400,
        name: order.id.slice(0, 32),
      });
      inviteLink = invite.invite_link;
      inviteLinkMap.set(delivery.id, inviteLink);
    } else if (!delivery.content) {
      throw new Error(`Produto sem conteúdo de entrega: ${product.name}`);
    }

    entries.push({ product, delivery, inviteLink });
  }

  return entries;
}

async function deliverPaidOrder({ prisma, bot, order }) {
  if (["paid", "refunded"].includes(order.status)) {
    return false;
  }

  const products = [order.product, ...(order.bumpProduct ? [order.bumpProduct] : [])];
  const inviteLinkMap = new Map();
  const deliveries = [];

  for (const product of products) {
    const productDeliveries = await buildDeliveryEntries({ bot, order, product, inviteLinkMap });
    deliveries.push(...productDeliveries);
  }

  try {
    const committed = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.order.updateMany({
        where: { id: order.id, status: { notIn: ["paid", "refunded"] } },
        data: { status: "paid" },
      });
      if (!updated.count) return false;

      const seenDeliveryIds = new Set();
      for (const entry of deliveries) {
        if (seenDeliveryIds.has(entry.delivery.id)) continue;
        seenDeliveryIds.add(entry.delivery.id);

        await transaction.access.create({
          data: {
            telegramUserId: order.telegramUserId,
            botId: order.botId,
            deliveryId: entry.delivery.id,
            inviteLink: entry.inviteLink,
            status: "active",
            expiresAt: entry.delivery.durationDays
              ? new Date(Date.now() + entry.delivery.durationDays * 86400000)
              : null,
          },
        });
      }
      return true;
    });

    if (!committed) {
      for (const entry of deliveries) {
        if (entry.inviteLink && entry.delivery.telegramChatId) {
          await bot.telegram.revokeChatInviteLink(entry.delivery.telegramChatId, entry.inviteLink).catch(() => undefined);
        }
      }
      return false;
    }
  } catch (error) {
    for (const entry of deliveries) {
      if (entry.inviteLink && entry.delivery.telegramChatId) {
        await bot.telegram.revokeChatInviteLink(entry.delivery.telegramChatId, entry.inviteLink).catch(() => undefined);
      }
    }
    throw error;
  }

  const message = ["✅ Pagamento aprovado!", ...deliveries.map(({ product, delivery, inviteLink }) => {
    const access = inviteLink || delivery.content;
    return `${product.name}:\n${access}`;
  })].join("\n\n");
  await bot.telegram.sendMessage(order.telegramUserId, message);
  return true;
}

async function reconcilePaidOrder({ prisma, bot, order }) {
  if (!order || ["paid", "refunded"].includes(order.status) || !order.paymentId) {
    return false;
  }

  if (order.paymentGateway === "mercadopago") {
    const credentials = await import("./payment-credentials.js").then((module) => module.resolvePaymentCredentials(prisma, order.bot, "mercadopago"));
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${order.paymentId}`, {
      headers: { Authorization: `Bearer ${credentials.accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || ""}` },
    });
    if (!paymentResponse.ok) return false;
    const paymentInfo = await paymentResponse.json();
    if (paymentInfo.status !== "approved") return false;
    return deliverPaidOrder({ prisma, bot, order: { ...order, status: "pending" } });
  }

  if (order.paymentGateway === "syncpay") {
    const { getSyncPayTransaction } = await import("./syncpay.js").then((module) => ({
      getSyncPayTransaction: module.getSyncPayTransaction,
    }));
    const credentials = await import("./payment-credentials.js").then((module) => module.resolvePaymentCredentials(prisma, order.bot, "syncpay"));
    const transaction = await getSyncPayTransaction({
      accessToken: credentials.accessToken,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      identifier: order.paymentId,
    });
    const status = transaction?.status || transaction?.state || "pending";
    const normalizedStatus = status.toLowerCase();
    if (!["approved", "completed", "paid", "success"].includes(normalizedStatus)) return false;
    return deliverPaidOrder({ prisma, bot, order: { ...order, status: "pending" } });
  }

  return false;
}

module.exports = { deliverPaidOrder, reconcilePaidOrder };