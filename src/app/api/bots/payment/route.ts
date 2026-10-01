import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { botId, method, pixKey, mpToken, amplopayId, amplopaySecret } = await req.json();

    if (!botId) return NextResponse.json({ message: "Missing botId" }, { status: 400 });

    // Verifica se o bot pertence ao workspace deste usuário
    const workspace = await prisma.workspace.findFirst({
      where: { userId: session.user.id }
    });

    if (!workspace) return NextResponse.json({ message: "Workspace not found" }, { status: 404 });

    const bot = await prisma.bot.findFirst({
      where: { id: botId, workspaceId: workspace.id }
    });

    if (!bot) return NextResponse.json({ message: "Bot not found" }, { status: 404 });

    // Atualiza
    await prisma.bot.update({
      where: { id: botId },
      data: {
        paymentMethod: method,
        pixKey: pixKey || null,
        mpAccessToken: mpToken || null,
        amploPayClientId: amplopayId || null,
        amploPayClientSecret: amplopaySecret || null
      }
    });

    return NextResponse.json({ message: "Success" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}
