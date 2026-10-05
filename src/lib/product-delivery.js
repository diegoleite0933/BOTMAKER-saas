const { recordPaidOrderFee } = require("./platform-fees.js");

async function deliverPaidOrder({ prisma, bot, order, splitConfirmed = false, splitReference = null }) {
  const products = [order.product, ...(order.bumpProduct ? [order.bumpProduct] : [])];
  const deliveries = [];

  for (const product of products) {
    const delivery = product.deliveries[0];
    if (!delivery) throw new Error(`Produto sem entrega configurada: ${product.name}`);

    let inviteLink = null;
    if (delivery.type === "group" || delivery.type === "channel") {
      if (!delivery.telegramChatId) throw new Error(`Produto sem grupo/canal de entrega: ${product.name}`);
      const invite = await bot.telegram.createChatInviteLink(delivery.telegramChatId, {
        member_limit: 1,
        expire_date: Math.floor(Date.now() / 1000) + 86400,
        name: order.id.slice(0, 32),
      });
      inviteLink = invite.invite_link;
    } else if (!delivery.content) {
      throw new Error(`Produto sem conteúdo de entrega: ${product.name}`);
    }

    deliveries.push({ product, delivery, inviteLink });
  }

  try {
    const transactionResult = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.order.updateMany({
        where: { id: order.id, status: { notIn: ["paid", "refunded"] } },
        data: { status: "paid" },
      });
      if (!updated.count) return { committed: false, fee: null };

      const fee = await recordPaidOrderFee(transaction, order, {
        paymentStatus: "PAID",
        splitConfirmed,
        splitReference,
      });

      for (const entry of deliveries) {
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
      return { committed: true, fee };
    });

    if (transactionResult?.committed === false || transactionResult === false) {
      for (const entry of deliveries) {
        if (entry.inviteLink && entry.delivery.telegramChatId) {
          await bot.telegram.revokeChatInviteLink(entry.delivery.telegramChatId, entry.inviteLink).catch(() => undefined);
        }
      }
      return false;
    }

    if (transactionResult?.fee?.created) {
      const gateway = String(order.paymentGateway || order.bot.paymentMethod || "unknown").toLowerCase();
      const transactionId = String(order.paymentId || order.id);
      console.info(`[PLATFORM_FEE] tenant=${order.bot.workspaceId} gateway=${gateway} transaction=${transactionId} sale=${order.id} fee=${transactionResult.fee.amountCents} status=${transactionResult.fee.status}`);
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

module.exports = { deliverPaidOrder };