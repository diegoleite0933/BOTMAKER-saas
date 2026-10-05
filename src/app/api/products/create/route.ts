import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
    }

    const { name, description, price, discountPercent, billingType, recurringInterval, botId, deliveryType, telegramChatId, content, durationDays, isOrderBumpOnly } = await req.json();
    const numericPrice = Number(price);
    const numericDiscount = Number(discountPercent || 0);
    const normalizedBillingType = billingType === "recurring" ? "recurring" : "one_time";
    const normalizedRecurringInterval = normalizedBillingType === "recurring" && (recurringInterval === "quarterly" || recurringInterval === "yearly") ? recurringInterval : "monthly";
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedChatId = typeof telegramChatId === "string" ? telegramChatId.trim() : "";
    const normalizedContent = typeof content === "string" ? content.trim() : "";
    const accessOffer = deliveryType === "group" || deliveryType === "channel";

    if (!normalizedName || normalizedName.length > 120 || !Number.isFinite(numericPrice) || numericPrice <= 0 || !botId) {
      return NextResponse.json({ message: "Dados incompletos" }, { status: 400 });
    }
    if (normalizedBillingType !== "one_time" && normalizedBillingType !== "recurring") {
      return NextResponse.json({ message: "Tipo de cobrança inválido." }, { status: 400 });
    }
    if (!Number.isInteger(numericDiscount) || numericDiscount < 0 || numericDiscount > 90) {
      return NextResponse.json({ message: "O desconto deve estar entre 0% e 90%." }, { status: 400 });
    }
    if (!accessOffer && deliveryType !== "file") {
      return NextResponse.json({ message: "Escolha acesso de grupo/canal ou produto com link externo." }, { status: 400 });
    }
    if (accessOffer && !normalizedChatId) return NextResponse.json({ message: "Informe o ID do grupo ou canal." }, { status: 400 });
    if (deliveryType === "file") {
      try {
        const url = new URL(normalizedContent);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid protocol");
      } catch {
        return NextResponse.json({ message: "Informe um link externo válido para o produto." }, { status: 400 });
      }
    }
    const numericDuration = durationDays === null || durationDays === "" ? null : Number(durationDays);
    if (accessOffer && numericDuration !== null && (!Number.isInteger(numericDuration) || numericDuration < 1)) {
      return NextResponse.json({ message: "A duração deve ser um número inteiro positivo." }, { status: 400 });
    }

    // Validação de segurança: bot pertence ao usuário?
    const workspace = await prisma.workspace.findFirst({
      where: { userId: session.user.id }
    });

    const bot = await prisma.bot.findFirst({
      where: { id: botId, workspaceId: workspace?.id }
    });

    if (!bot) {
      return NextResponse.json({ message: "Bot não encontrado" }, { status: 404 });
    }

    const product = await prisma.product.create({
      data: {
        name: normalizedName,
        description: typeof description === "string" ? description.trim() || null : null,
        price: numericPrice,
        discountPercent: numericDiscount,
        billingType: normalizedBillingType,
        recurringInterval: normalizedBillingType === "recurring" ? normalizedRecurringInterval : null,
        botId,
        isOrderBumpOnly: isOrderBumpOnly === true,
        deliveries: {
          create: {
            type: deliveryType,
            telegramChatId: accessOffer ? normalizedChatId : null,
            content: deliveryType === "file" ? normalizedContent : null,
            durationDays: accessOffer ? numericDuration : null,
          }
        }
      }
    });

    return NextResponse.json({ message: "Produto criado", product }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 });
  }
}
