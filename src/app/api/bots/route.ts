import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: session.user.id }
  });

  const bots = await prisma.bot.findMany({
    where: { workspaceId: workspace?.id }
  });

  return NextResponse.json({ bots });
}
