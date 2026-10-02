import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { saoPauloDateKey, saoPauloDayStart } from "@/lib/sao-paulo-time";

const prisma = new PrismaClient();
const hourInMilliseconds = 60 * 60 * 1000;
const dailyRanges = [7, 15, 30, 365];

function calendarLabel(dateKey: string, includeYear: boolean) {
  const [year, month, day] = dateKey.split("-");
  return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

function hourLabel(date: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.day}/${values.month} ${values.hour}h`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const requestedRange = url.searchParams.get("range");
  const hourly = requestedRange === "24h";
  const requestedDays = Number(requestedRange || url.searchParams.get("days"));
  const days = dailyRanges.includes(requestedDays) ? requestedDays : 7;
  const now = new Date();
  const start = hourly
    ? new Date(now.getTime() - 24 * hourInMilliseconds)
    : (() => {
      const today = saoPauloDateKey(now);
        const [year, month, day] = today.split("-").map(Number);
        const firstDay = new Date(Date.UTC(year, month - 1, day));
        firstDay.setUTCDate(firstDay.getUTCDate() - days + 1);
        const firstDateKey = firstDay.toISOString().slice(0, 10);
        return saoPauloDayStart(firstDateKey);
      })();

  const orders = await prisma.order.findMany({
    where: {
      bot: { workspace: { userId } },
      createdAt: { gte: start, lte: now },
      status: { in: ["paid", "pending", "review"] },
    },
    select: { amount: true, status: true, createdAt: true },
  });

  const points = new Map<string, { label: string; paid: number; pending: number }>();
  if (hourly) {
    const lastHour = Math.floor(now.getTime() / hourInMilliseconds) * hourInMilliseconds;
    for (let offset = 23; offset >= 0; offset -= 1) {
      const hour = new Date(lastHour - offset * hourInMilliseconds);
      const key = String(hour.getTime());
      points.set(key, { label: hourLabel(hour), paid: 0, pending: 0 });
    }
  } else {
    const today = saoPauloDateKey(now);
    const [year, month, day] = today.split("-").map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, day));
    firstDay.setUTCDate(firstDay.getUTCDate() - days + 1);
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(firstDay);
      date.setUTCDate(firstDay.getUTCDate() + offset);
      const dateKey = date.toISOString().slice(0, 10);
      points.set(dateKey, { label: calendarLabel(dateKey, days > 30), paid: 0, pending: 0 });
    }
  }

  for (const order of orders) {
    const key = hourly
      ? String(Math.floor(order.createdAt.getTime() / hourInMilliseconds) * hourInMilliseconds)
      : saoPauloDateKey(order.createdAt);
    const point = points.get(key);
    if (!point) continue;
    if (order.status === "paid") point.paid += order.amount;
    else point.pending += order.amount;
  }

  const data = Array.from(points.values());
  return NextResponse.json({ range: hourly ? "24h" : `${days}d`, data });
}