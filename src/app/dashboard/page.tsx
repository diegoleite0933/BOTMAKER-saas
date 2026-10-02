import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { SalesChart } from "./SalesChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const prisma = new PrismaClient();

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const userId = (user as { id?: string } | undefined)?.id;

  const workspaceScope = { bot: { workspace: { userId } } };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [botsCount, accessCount, productsCount, paidToday, latestOrders] = await Promise.all([
    prisma.bot.count({ where: { workspace: { userId }, status: "active" } }),
    prisma.access.count({ where: { bot: { workspace: { userId } }, status: "active" } }),
    prisma.product.count({ where: { bot: { workspace: { userId } } } }),
    prisma.order.aggregate({ where: { ...workspaceScope, status: "paid", createdAt: { gte: today } }, _sum: { amount: true } }),
    prisma.order.findMany({
      where: workspaceScope,
      include: { product: true, bot: true, telegramUser: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const formatCurrency = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Visão Geral</h1>
        </div>
        <Link href="/dashboard/bots/new" className={buttonVariants({ className: "bg-blue-600 hover:bg-blue-700 text-white" })}>+ Novo Bot</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas (Hoje)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(paidToday._sum.amount || 0)}</div>
            <p className="text-xs text-slate-500">Pagamentos confirmados hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bots Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{botsCount}</div>
            <p className="text-xs text-slate-500">Conectados ao Telegram</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acessos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accessCount}</div>
            <p className="text-xs text-slate-500">Membros em grupos VIPs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productsCount}</div>
            <p className="text-xs text-slate-500">Cadastrados</p>
          </CardContent>
        </Card>
      </div>

      <SalesChart />

      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Últimas Vendas</CardTitle>
          <CardDescription>Pedidos recentes de todos os seus bots.</CardDescription>
        </CardHeader>
        <CardContent>
          {latestOrders.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center text-center text-sm text-slate-500">
              Nenhuma venda realizada ainda. Conecte seu bot para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente / Produto</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="min-w-48">
                        <span className="block font-medium text-slate-900">{order.telegramUser.firstName || order.telegramUser.username || "Cliente Telegram"}</span>
                        <span className="text-xs text-slate-500">{order.product.name}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{order.bot.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{formatCurrency(order.amount)}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${order.status === "paid" ? "bg-emerald-50 text-emerald-800" : order.status === "review" ? "bg-amber-50 text-amber-800" : "bg-cyan-50 text-cyan-800"}`}>
                          {order.status === "paid" ? "Pago" : order.status === "review" ? "Em revisão" : "Aguardando"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
