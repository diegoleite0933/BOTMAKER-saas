import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import { formatSaoPauloDate } from "@/lib/sao-paulo-time";
import { DashboardOverview } from "./DashboardOverview";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const prisma = new PrismaClient();

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; name?: string | null; nickname?: string | null } | undefined;
  const userId = user?.id;
  if (!userId) redirect("/login");

  const latestOrders = await prisma.order.findMany({
      where: { bot: { workspace: { userId } } },
      include: { product: true, bot: true, telegramUser: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

  const formatCurrency = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const nickname = user.nickname || user.name || "ODISSEIA";

  return (
    <div className="min-w-0 space-y-5 md:space-y-8">
      <DashboardOverview userName={nickname} />

      <Card className="border-[#1c1c1c] bg-[#090909] text-white">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-white">Últimas vendas</CardTitle>
          <CardDescription className="text-[#777]">Pedidos recentes de todos os seus bots.</CardDescription>
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
                        <span className="block font-medium text-white">{order.telegramUser.firstName || order.telegramUser.username || "Cliente Telegram"}</span>
                        <span className="text-xs text-[#777]">{order.product.name}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{order.bot.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatSaoPauloDate(order.createdAt)}</TableCell>
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
