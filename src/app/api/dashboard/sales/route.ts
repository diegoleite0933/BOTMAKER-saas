import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();
const allowedRanges = [7, 15, 30, 265];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const requestedDays = Number(new URL(request.url).searchParams.get("days"));
  const days = allowedRanges.includes(requestedDays) ? requestedDays : 7;
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);

  const orders = await prisma.order.findMany({
    where: {
      bot: { workspace: { userId } },
      createdAt: { gte: start, lte: end },
      status: { in: ["paid", "pending", "review"] },
    },
    select: { amount: true, status: true, createdAt: true },
  });

  const points = new Map<string, { paid: number; pending: number }>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    points.set(date.toISOString().slice(0, 10), { paid: 0, pending: 0 });
  }

  for (const order of orders) {
    const day = order.createdAt.toISOString().slice(0, 10);
    const point = points.get(day);
    if (!point) continue;
    if (order.status === "paid") point.paid += order.amount;
    else point.pending += order.amount;
  }

  const data = Array.from(points, ([date, values]) => ({ date, ...values }));
  return NextResponse.json({ days, data });
}