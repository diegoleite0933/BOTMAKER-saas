import { PrismaClient } from "@prisma/client";
import { saoPauloDateKey, saoPauloDayStart } from "@/lib/sao-paulo-time";

const prisma = new PrismaClient();
const hourMilliseconds = 60 * 60 * 1000;

export type DashboardPeriod = "today" | "yesterday" | "7d" | "30d" | "all";

type OrderPoint = { amount: number; status: string; createdAt: Date; botId: string };

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function bucketKey(date: Date, kind: "hour" | "day" | "week" | "month") {
  if (kind === "hour") return String(Math.floor(date.getTime() / hourMilliseconds) * hourMilliseconds);
  const dateKey = saoPauloDateKey(date);
  if (kind === "month") return dateKey.slice(0, 7);
  if (kind === "week") return startOfWeek(dateKey);
  return dateKey;
}

function formatHour(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(date);
}

function formatDay(dateKey: string, period: DashboardPeriod) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (period === "7d") return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" }).format(date).replace(".", "");
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function createSeries(orders: OrderPoint[], period: DashboardPeriod, now: Date, rangeStart: Date | null) {
  const todayKey = saoPauloDateKey(now);
  let kind: "hour" | "day" | "week" | "month" = "day";
  const keys: string[] = [];

  if (period === "today" || period === "yesterday") {
    kind = "hour";
    const start = rangeStart || saoPauloDayStart(todayKey);
    const hours = period === "today" ? Math.max(1, Math.ceil((now.getTime() - start.getTime()) / hourMilliseconds)) : 24;
    for (let offset = 0; offset < hours; offset += 1) keys.push(String(Math.floor((start.getTime() + offset * hourMilliseconds) / hourMilliseconds) * hourMilliseconds));
  } else {
    const oldestOrder = orders.reduce<Date | null>((oldest, order) => !oldest || order.createdAt < oldest ? order.createdAt : oldest, null);
    const firstKey = period === "all" && oldestOrder ? saoPauloDateKey(oldestOrder) : shiftDateKey(todayKey, -(period === "30d" ? 29 : 6));
    const spanDays = Math.floor((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${firstKey}T00:00:00Z`)) / 86400000) + 1;
    kind = period === "all" && spanDays > 365 ? "month" : period === "all" && spanDays > 90 ? "week" : "day";

    if (kind === "month") {
      let month = firstKey.slice(0, 7);
      const lastMonth = todayKey.slice(0, 7);
      while (month <= lastMonth) {
        keys.push(month);
        const [year, monthNumber] = month.split("-").map(Number);
        month = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
      }
    } else if (kind === "week") {
      let week = startOfWeek(firstKey);
      const lastWeek = startOfWeek(todayKey);
      while (week <= lastWeek) {
        keys.push(week);
        week = shiftDateKey(week, 7);
      }
    } else {
      const dayCount = period === "all" ? spanDays : period === "30d" ? 30 : 7;
      for (let offset = 0; offset < dayCount; offset += 1) keys.push(shiftDateKey(firstKey, offset));
    }
  }

  const values = new Map(keys.map((key) => [key, 0]));
  for (const order of orders) {
    if (order.status !== "paid") continue;
    const key = bucketKey(order.createdAt, kind);
    if (values.has(key)) values.set(key, (values.get(key) || 0) + order.amount);
  }

  return keys.map((key) => ({
    label: kind === "hour"
      ? `${formatHour(new Date(Number(key)))}h`
      : kind === "month"
        ? `${key.slice(5, 7)}/${key.slice(0, 4)}`
        : kind === "week"
          ? formatDay(key, "30d")
          : formatDay(key, period),
    revenue: values.get(key) || 0,
  }));
}

function getPeriodRange(period: DashboardPeriod, now: Date) {
  const today = saoPauloDateKey(now);
  if (period === "all") return { start: null, end: now };
  if (period === "yesterday") {
    const yesterday = shiftDateKey(today, -1);
    return { start: saoPauloDayStart(yesterday), end: saoPauloDayStart(today) };
  }
  const firstDay = period === "today" ? today : shiftDateKey(today, -(period === "30d" ? 29 : 6));
  return { start: saoPauloDayStart(firstDay), end: now };
}

export async function getDashboardMetrics(
  userId: string,
  period: DashboardPeriod,
  database: typeof prisma = prisma,
  now = new Date(),
) {
  const { start, end } = getPeriodRange(period, now);
  const orderWhere = {
    bot: { workspace: { userId } },
    createdAt: { ...(start ? { gte: start } : {}), lte: end },
  };

  const [orders, starts, activeBots, activeAccesses, activeProducts, user] = await Promise.all([
    database.order.findMany({ where: orderWhere, select: { amount: true, status: true, createdAt: true, botId: true } }),
    database.telegramUser.count({
      where: {
        bot: { workspace: { userId } },
        ...(start ? { lastStartedAt: { gte: start, lt: end } } : {}),
      },
    }),
    database.bot.count({ where: { workspace: { userId }, status: "active" } }),
    database.access.count({ where: { telegramUser: { bot: { workspace: { userId } } }, status: "active" } }),
    database.product.count({ where: { bot: { workspace: { userId } }, status: "active", isOrderBumpOnly: false } }),
    database.user.findUnique({ where: { id: userId }, select: { revenueGoal: true } }),
  ]);

  const paidOrders = orders.filter((order) => order.status === "paid");
  const revenue = paidOrders.reduce((total, order) => total + order.amount, 0);
  const pendingOrders = orders.filter((order) => order.status === "pending" || order.status === "review").length;
  const botTotals = new Map<string, number>();
  for (const order of paidOrders) botTotals.set(order.botId, (botTotals.get(order.botId) || 0) + order.amount);

  const bots = await database.bot.findMany({
    where: { id: { in: Array.from(botTotals.keys()) }, workspace: { userId } },
    select: { id: true, name: true },
  });
  const ranking = bots
    .map((bot) => ({ botId: bot.id, name: bot.name, total: botTotals.get(bot.id) || 0 }))
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));

  return {
    period,
    metrics: {
      revenue,
      revenueGoal: user?.revenueGoal || null,
      approvedSales: paidOrders.length,
      totalPix: orders.length,
      conversionRate: starts ? (paidOrders.length / starts) * 100 : 0,
      starts,
      averageTicket: paidOrders.length ? revenue / paidOrders.length : 0,
      pendingOrders,
      activeBots,
      activeAccesses,
      activeProducts,
    },
    data: createSeries(orders, period, now, start),
    ranking,
  };
}

export function isDashboardPeriod(value: string | null): value is DashboardPeriod {
  return value === "today" || value === "yesterday" || value === "7d" || value === "30d" || value === "all";
}