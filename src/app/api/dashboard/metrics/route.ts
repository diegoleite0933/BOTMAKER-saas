import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getDashboardMetrics, isDashboardPeriod } from "@/lib/dashboard-metrics";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; isBanned?: boolean } | undefined)?.id;
  if (!userId || (session?.user as { isBanned?: boolean } | undefined)?.isBanned) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const requestedPeriod = new URL(request.url).searchParams.get("period");
  const period = isDashboardPeriod(requestedPeriod) ? requestedPeriod : "7d";
  return NextResponse.json(await getDashboardMetrics(userId, period), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; isBanned?: boolean } | undefined)?.id;
  if (!userId || (session?.user as { isBanned?: boolean } | undefined)?.isBanned) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const goal = Number(body.revenueGoal);
  if (!Number.isFinite(goal) || goal < 0 || goal > 1000000000) {
    return NextResponse.json({ message: "Informe uma meta entre R$ 0 e R$ 1.000.000.000." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { revenueGoal: goal || null } });
  return NextResponse.json({ revenueGoal: goal || null });
}