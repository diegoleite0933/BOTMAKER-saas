import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();
const deliveryTypes = ["group", "channel", "file", "text"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const workspace = await prisma.workspace.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!workspace) return NextResponse.json({ message: "Produto não encontrado" }, { status: 404 });

    const product = await prisma.product.findFirst({
      where: { id, bot: { workspaceId: workspace.id } },
      include: { deliveries: { take: 1 } },
    });
    if (!product) return NextResponse.json({ message: "Produto não encontrado" }, { status: 404 });

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const price = Number(body.price);
    const billingType = body.billingType === "recurring" ? "recurring" : "one_time";
    const recurringInterval = billingType === "recurring" && (body.recurringInterval === "monthly" || body.recurringInterval === "quarterly" || body.recurringInterval === "yearly") ? body.recurringInterval : "monthly";
    const discountPercent = Number(body.discountPercent || 0);
    const botId = typeof body.botId === "string" ? body.botId : "";
    const status = body.status;
    const isOrderBumpOnly = body.isOrderBumpOnly === true;
    const orderBumpProductId = typeof body.orderBumpProductId === "string" && body.orderBumpProductId ? body.orderBumpProductId : null;
    const telegramMediaId = typeof body.telegramMediaId === "string" && body.telegramMediaId ? body.telegramMediaId : null;
    const telegramMediaType = body.telegramMediaType === "photo" || body.telegramMediaType === "video" ? body.telegramMediaType : null;
    const deliveryType = body.deliveryType;
    const telegramChatId = typeof body.telegramChatId === "string" ? body.telegramChatId.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const durationDays = body.durationDays === null || body.durationDays === "" ? null : Number(body.durationDays);

    if (!name || name.length > 120 || !Number.isFinite(price) || price <= 0 || !botId) {
      return NextResponse.json({ message: "Confira o nome, o preço e o bot selecionado." }, { status: 400 });
    }
    if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 90) {
      return NextResponse.json({ message: "O desconto deve estar entre 0% e 90%." }, { status: 400 });
    }
    if (status !== "active" && status !== "inactive") {
      return NextResponse.json({ message: "Status inválido." }, { status: 400 });
    }
    if (!deliveryTypes.includes(deliveryType)) {
      return NextResponse.json({ message: "Tipo de entrega inválido." }, { status: 400 });
    }
    if ((deliveryType === "group" || deliveryType === "channel") ? !telegramChatId : !content) {
      return NextResponse.json({ message: "Preencha os dados da entrega." }, { status: 400 });
    }
    if (deliveryType === "text") {
      return NextResponse.json({ message: "Ofertas devem ser acesso do Telegram ou produto com link externo." }, { status: 400 });
    }
    if (deliveryType === "file") {
      try {
        const externalUrl = new URL(content);
        if (externalUrl.protocol !== "https:" && externalUrl.protocol !== "http:") throw new Error("invalid protocol");
      } catch {
        return NextResponse.json({ message: "Informe um link externo válido para o produto." }, { status: 400 });
      }
    }
    if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1)) {
      return NextResponse.json({ message: "A duração deve ser um número inteiro positivo." }, { status: 400 });
    }
    if (telegramMediaId && !telegramMediaType) {
      return NextResponse.json({ message: "Tipo de mídia inválido." }, { status: 400 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: botId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!bot) return NextResponse.json({ message: "Bot não encontrado" }, { status: 404 });

    if (orderBumpProductId) {
      if (orderBumpProductId === product.id) {
        return NextResponse.json({ message: "Um produto não pode oferecer a si mesmo como order bump." }, { status: 400 });
      }
      const bumpProduct = await prisma.product.findFirst({
        where: { id: orderBumpProductId, botId, status: "active", isOrderBumpOnly: true },
        select: { id: true },
      });
      if (!bumpProduct) {
        return NextResponse.json({ message: "Selecione um produto ativo e exclusivo de order bump deste bot." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.product.update({
        where: { id: product.id },
        data: {
          name,
          description: description || null,
          price,
          discountPercent,
          billingType,
          recurringInterval: billingType === "recurring" ? recurringInterval : null,
          botId,
          status,
          isOrderBumpOnly,
          orderBumpProductId,
          telegramMediaId,
          telegramMediaType: telegramMediaId ? telegramMediaType : null,
        },
      });

      const deliveryData = {
        type: deliveryType,
        telegramChatId: deliveryType === "group" || deliveryType === "channel" ? telegramChatId : null,
        content: deliveryType === "file" || deliveryType === "text" ? content : null,
        durationDays,
      };

      if (product.deliveries[0]) {
        await transaction.productDelivery.update({ where: { id: product.deliveries[0].id }, data: deliveryData });
      } else {
        await transaction.productDelivery.create({ data: { ...deliveryData, productId: product.id } });
      }
    });

    return NextResponse.json({ message: "Produto atualizado" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erro interno ao atualizar produto" }, { status: 500 });
  }
}