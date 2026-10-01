import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { normalizeCpf } from "@/lib/account-security";

const prisma = new PrismaClient();

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const cpf = normalizeCpf(body.cpf);
  if (!cpf) return NextResponse.json({ message: "Informe um CPF válido." }, { status: 400 });

  try {
    await prisma.user.update({ where: { id: userId }, data: { cpf } });
    return NextResponse.json({ message: "CPF salvo." });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ message: "Este CPF já está associado a outra conta." }, { status: 409 });
    }
    console.error("Erro ao salvar CPF:", error);
    return NextResponse.json({ message: "Não foi possível salvar o CPF." }, { status: 500 });
  }
}