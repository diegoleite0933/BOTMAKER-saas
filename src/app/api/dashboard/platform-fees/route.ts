import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getWorkspaceFeeSummary } from "@/lib/platform-fees.js";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isBanned?: boolean } | undefined;
  if (!user?.id || user.isBanned) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  return NextResponse.json({
    feeCentsPerPaidSale: 30,
    currency: "BRL",
    ...(await getWorkspaceFeeSummary(prisma, user.id)),
  });
}