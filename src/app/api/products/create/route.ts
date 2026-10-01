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

    const { name, description, price, botId, telegramChatId } = await req.json();

    if (!name || !price || !botId || !telegramChatId) {
      return NextResponse.json({ message: "Dados incompletos" }, { status: 400 });
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
        name,
        description,
        price,
        botId,
        deliveries: {
          create: {
            type: "group", // fixo como grupo/canal por enquanto
            telegramChatId
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
