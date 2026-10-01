import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/account-security";

const prisma = new PrismaClient();

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as ({ id?: string; isBanned?: boolean } | undefined);
  return sessionUser?.id && !sessionUser.isBanned && isAdminEmail(session?.user?.email) ? session : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      isBanned: true,
      createdAt: true,
      _count: { select: { workspaces: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 403 });
  }

  const body = await request.json();
  if (typeof body.userId !== "string" || typeof body.isBanned !== "boolean") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, email: true },
  });
  if (!target) return NextResponse.json({ message: "Conta não encontrada." }, { status: 404 });
  if (isAdminEmail(target.email)) {
    return NextResponse.json({ message: "A conta administradora não pode ser bloqueada aqui." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: target.id }, data: { isBanned: body.isBanned } });
  return NextResponse.json({ message: body.isBanned ? "Conta bloqueada." : "Conta desbloqueada." });
}