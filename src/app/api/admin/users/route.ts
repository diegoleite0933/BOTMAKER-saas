import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/account-security";

const prisma = new PrismaClient();

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as ({ id?: string; isBanned?: boolean } | undefined);
  return sessionUser?.id && !sessionUser.isBanned && isAdminEmail(session?.user?.email) ? session : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      isBanned: true,
      createdAt: true,
      workspaces: { select: { id: true, bots: { select: { id: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const botIds = users.flatMap((user) => user.workspaces.flatMap((workspace) => workspace.bots.map((bot) => bot.id)));
  const [paidOrdersByBot, bots] = botIds.length
    ? await Promise.all([
        prisma.order.groupBy({
          by: ["botId"],
          where: { botId: { in: botIds }, status: "paid" },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.bot.findMany({ where: { id: { in: botIds } }, select: { id: true, workspace: { select: { userId: true } } } }),
      ])
    : [[], []];
  const ownerByBot = new Map(bots.map((bot) => [bot.id, bot.workspace.userId]));
  const salesByUser = new Map<string, { amount: number; count: number }>();
  for (const botSales of paidOrdersByBot) {
    const ownerId = ownerByBot.get(botSales.botId);
    if (!ownerId) continue;
    const current = salesByUser.get(ownerId) || { amount: 0, count: 0 };
    current.amount += botSales._sum.amount || 0;
    current.count += botSales._count._all;
    salesByUser.set(ownerId, current);
  }

  return NextResponse.json({
    users: users.map(({ workspaces, ...user }) => ({
      ...user,
      _count: { workspaces: workspaces.length },
      sales: salesByUser.get(user.id) || { amount: 0, count: 0 },
    })),
  });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 403 });
  }

  const body = await request.json();
  if (typeof body.userId !== "string" || typeof body.isBanned !== "boolean") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, email: true },
  });
  if (!target) return NextResponse.json({ message: "Conta não encontrada." }, { status: 404 });
  if (isAdminEmail(target.email)) {
    return NextResponse.json({ message: "A conta administradora não pode ser bloqueada aqui." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: target.id }, data: { isBanned: body.isBanned } });
  return NextResponse.json({ message: body.isBanned ? "Conta bloqueada." : "Conta desbloqueada." });
}