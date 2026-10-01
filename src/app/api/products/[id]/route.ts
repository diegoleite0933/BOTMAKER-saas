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
    const botId = typeof body.botId === "string" ? body.botId : "";
    const status = body.status;
    const deliveryType = body.deliveryType;
    const telegramChatId = typeof body.telegramChatId === "string" ? body.telegramChatId.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const durationDays = body.durationDays === null || body.durationDays === "" ? null : Number(body.durationDays);

    if (!name || name.length > 120 || !Number.isFinite(price) || price <= 0 || !botId) {
      return NextResponse.json({ message: "Confira o nome, o preço e o bot selecionado." }, { status: 400 });
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
    if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1)) {
      return NextResponse.json({ message: "A duração deve ser um número inteiro positivo." }, { status: 400 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: botId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!bot) return NextResponse.json({ message: "Bot não encontrado" }, { status: 404 });

    await prisma.$transaction(async (transaction) => {
      await transaction.product.update({
        where: { id: product.id },
        data: { name, description: description || null, price, botId, status },
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