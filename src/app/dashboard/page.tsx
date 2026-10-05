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

  const workspaces = await prisma.workspace.findMany({ where: { userId }, select: { id: true } });
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const [latestOrders, feeGroups] = await Promise.all([prisma.order.findMany({
      where: { bot: { workspace: { userId } } },
      include: { product: true, bot: true, telegramUser: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }), workspaceIds.length ? prisma.platformFeeLedger.groupBy({
      by: ["status", "entryType"],
      where: { workspaceId: { in: workspaceIds } },
      _sum: { amountCents: true },
      _count: { _all: true },
    }) : Promise.resolve([])]);

  const formatCurrency = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatCents = (cents: number) => formatCurrency(cents / 100);
  const feeSum = (status: string, entryType = "SALE_FEE") => feeGroups
    .filter((group) => group.status === status && group.entryType === entryType)
    .reduce((sum, group) => sum + (group._sum.amountCents || 0), 0);
  const generatedCents = feeGroups
    .filter((group) => group.entryType === "SALE_FEE")
    .reduce((sum, group) => sum + (group._sum.amountCents || 0), 0);
  const waivedSales = feeGroups
    .filter((group) => group.status === "WAIVED" && group.entryType === "SALE_FEE")
    .reduce((sum, group) => sum + group._count._all, 0);
  const refundAdjustmentCents = feeGroups
    .filter((group) => group.entryType === "REFUND_ADJUSTMENT")
    .reduce((sum, group) => sum + (group._sum.amountCents || 0), 0);
  const nickname = user.nickname || user.name || "ODISSEIA";

  return (
    <div className="min-w-0 space-y-5 md:space-y-8">
      <DashboardOverview userName={nickname} />

      <Card className="rounded-md border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Taxa da plataforma</CardTitle>
          <CardDescription>R$ 0,30 fixa por venda paga em gateways elegíveis. PIX Direto é isento. Pendente não significa recebido.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 xl:grid-cols-5">
          <div><p className="text-xs text-slate-500">Taxas geradas</p><p className="mt-1 text-xl font-semibold">{formatCents(generatedCents)}</p></div>
          <div><p className="text-xs text-slate-500">Recebidas</p><p className="mt-1 text-xl font-semibold">{formatCents(feeSum("RECEIVED"))}</p></div>
          <div><p className="text-xs text-slate-500">Pendentes</p><p className="mt-1 text-xl font-semibold">{formatCents(feeSum("PENDING"))}</p></div>
          <div><p className="text-xs text-slate-500">Ajustes de reembolso</p><p className="mt-1 text-xl font-semibold">{formatCents(refundAdjustmentCents)}</p></div>
          <div><p className="text-xs text-slate-500">Vendas isentas</p><p className="mt-1 text-xl font-semibold">{waivedSales}</p></div>
        </CardContent>
      </Card>

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
