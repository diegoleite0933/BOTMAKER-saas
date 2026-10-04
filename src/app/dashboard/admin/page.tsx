import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/account-security";
import { AdminConsole } from "./AdminConsole";

const prisma = new PrismaClient();

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !isAdminEmail(session.user?.email) || !userId) redirect("/dashboard");

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
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { cpf: true } });

  const initialUsers = users.map(({ workspaces, ...user }) => ({
    ...user,
    _count: { workspaces: workspaces.length },
    sales: salesByUser.get(user.id) || { amount: 0, count: 0 },
  }));

  return <AdminConsole initialUsers={initialUsers} initialCpf={admin?.cpf || ""} />;
}