import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { formatSaoPauloDate } from "@/lib/sao-paulo-time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const prisma = new PrismaClient();

export default async function SalesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { bot: { workspace: { userId } } },
    include: { product: true, bot: true, telegramUser: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const formatCurrency = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendas e Pedidos</h1>
          <p className="text-slate-500">Acompanhe todas as transações realizadas.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vendas</CardTitle>
          <CardDescription>Pedidos recentes de todos os seus bots.</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center text-center text-sm text-slate-500">
              Ainda não há pedidos para exibir.
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
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="min-w-48">
                        <span className="block font-medium text-slate-900">{order.telegramUser.firstName || order.telegramUser.username || "Cliente Telegram"}</span>
                        <span className="text-xs text-slate-500">{order.product.name}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{order.bot.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatSaoPauloDate(order.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{formatCurrency(order.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {order.status === "paid" ? "Pago" : order.status === "review" ? "Em revisão" : order.status === "pending" ? "Aguardando" : order.status}
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
