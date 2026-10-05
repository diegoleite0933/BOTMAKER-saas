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

    const { name, token } = await req.json();

    if (!name || !token) {
      return NextResponse.json({ message: "Nome e Token são obrigatórios" }, { status: 400 });
    }

    // 1. Validar o token com a API do Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return NextResponse.json({ message: "Token do Telegram inválido." }, { status: 400 });
    }

    const botUsername = tgData.result.username;

    // 2. Achar o workspace do usuário
    const workspace = await prisma.workspace.findFirst({
      where: { userId: session.user.id }
    });

    if (!workspace) {
      return NextResponse.json({ message: "Workspace não encontrado" }, { status: 400 });
    }

    // 3. Salvar no banco
    const newBot = await prisma.bot.create({
      data: {
        name,
        token,
        username: botUsername,
        workspaceId: workspace.id,
        status: "active"
      }
    });

    return NextResponse.json({ 
      message: "Bot conectado com sucesso",
      bot: { id: newBot.id, username: newBot.username } 
    }, { status: 201 });

  } catch (error) {
    console.error("Erro ao conectar bot:", error);
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 });
  }
}
