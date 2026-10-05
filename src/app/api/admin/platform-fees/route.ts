import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/account-security";

const prisma = new PrismaClient();

async function isAuthorizedPlatformAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isBanned?: boolean } | undefined;
  return Boolean(user?.id && !user.isBanned && isAdminEmail(session?.user?.email));
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
}

export async function GET(request: Request) {
  if (!(await isAuthorizedPlatformAdmin())) return NextResponse.json({ message: "Não autorizado." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"), true);
  if (from === undefined || to === undefined || (from && to && from > to)) {
    return NextResponse.json({ message: "Período inválido." }, { status: 400 });
  }

  const workspaceId = params.get("tenantId") || undefined;
  const gateway = params.get("gateway") || undefined;
  const status = params.get("status") || undefined;
  const dateFilter = from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
  const baseWhere = { ...(workspaceId ? { workspaceId } : {}), ...(gateway ? { gateway } : {}), ...dateFilter };
  const listWhere = { ...baseWhere, ...(status ? { status } : {}) };
  const page = Math.max(1, Number(params.get("page") || 1));
  const take = Math.min(100, Math.max(1, Number(params.get("take") || 50)));

  const saleConditions: Prisma.Sql[] = [Prisma.sql`"Order"."status" = 'paid'`];
  if (workspaceId) saleConditions.push(Prisma.sql`"Bot"."workspaceId" = ${workspaceId}`);
  if (gateway) saleConditions.push(Prisma.sql`"Order"."paymentGateway" = ${gateway}`);
  if (from) saleConditions.push(Prisma.sql`"Order"."createdAt" >= ${from}`);
  if (to) saleConditions.push(Prisma.sql`"Order"."createdAt" <= ${to}`);

  const [statusGroups, entryGroups, rows, tenants, salesAggregate] = await Promise.all([
    prisma.platformFeeLedger.groupBy({ by: ["status"], where: baseWhere, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.platformFeeLedger.groupBy({ by: ["entryType"], where: baseWhere, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.platformFeeLedger.findMany({
      where: listWhere,
      include: {
        workspace: { select: { id: true, name: true, user: { select: { id: true, email: true, nickname: true } } } },
        order: { select: { id: true, status: true, amount: true, paymentId: true, paymentGateway: true, createdAt: true } },
        events: { orderBy: { createdAt: "desc" }, take: 10, select: { eventType: true, fromStatus: true, toStatus: true, reference: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.workspace.findMany({ select: { id: true, name: true, user: { select: { email: true, nickname: true } } }, orderBy: { name: "asc" } }),
    prisma.$queryRaw<{ count: bigint; amountCents: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count,
        COALESCE(SUM(ROUND("Order"."amount"::numeric * 100)), 0)::bigint AS "amountCents"
      FROM "Order"
      INNER JOIN "Bot" ON "Bot"."id" = "Order"."botId"
      WHERE ${Prisma.join(saleConditions, " AND ")}
    `),
  ]);

  const sum = (name: string) => statusGroups.find((group) => group.status === name)?._sum.amountCents || 0;
  const count = (name: string) => statusGroups.find((group) => group.status === name)?._count._all || 0;
  return NextResponse.json({
    config: { enabled: true, type: "FIXED", amountCents: 30, currency: "BRL", exemptGateway: "pix_direto" },
    summary: {
      pendingCents: sum("PENDING"),
      receivedCents: sum("RECEIVED"),
      failedCents: sum("FAILED"),
      waivedCount: count("WAIVED"),
      generatedCents: entryGroups.find((group) => group.entryType === "SALE_FEE")?._sum.amountCents || 0,
      feeEntries: entryGroups.find((group) => group.entryType === "SALE_FEE")?._count._all || 0,
      refundAdjustmentCents: entryGroups.find((group) => group.entryType === "REFUND_ADJUSTMENT")?._sum.amountCents || 0,
      paidSalesCount: Number(salesAggregate[0]?.count || 0),
      paidSalesAmountCents: Number(salesAggregate[0]?.amountCents || 0),
      averagePaidSaleCents: salesAggregate[0]?.count
        ? Math.round(Number(salesAggregate[0].amountCents) / Number(salesAggregate[0].count))
        : 0,
    },
    tenants,
    page,
    take,
    entries: rows.map((row) => ({
      id: row.id,
      tenantId: row.workspace.id,
      tenantName: row.workspace.name,
      tenantEmail: row.workspace.user.email,
      tenantNickname: row.workspace.user.nickname,
      saleId: row.order.id,
      saleStatus: row.order.status,
      saleAmountCents: Math.round(row.order.amount * 100),
      gateway: row.gateway,
      providerTransactionId: row.providerTransactionId,
      entryType: row.entryType,
      feeAmountCents: row.amountCents,
      currency: row.currency,
      status: row.status,
      providerReference: row.providerReference,
      failureReason: row.failureReason,
      paidAt: row.paidAt,
      receivedAt: row.receivedAt,
      createdAt: row.createdAt,
      metadata: row.metadata,
      events: row.events,
    })),
  });
}