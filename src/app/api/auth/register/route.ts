import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { normalizeCpf } from "@/lib/account-security";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { name, email, password, cpf } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedCpf = normalizeCpf(cpf);

    if (!name || !normalizedEmail || !password || !normalizedCpf) {
      return NextResponse.json(
        { message: "Informe nome, e-mail, senha e um CPF válido." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { cpf: normalizedCpf }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: existingUser.email === normalizedEmail ? "E-mail já cadastrado" : "CPF já cadastrado" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        cpf: normalizedCpf,
        password: hashedPassword,
        workspaces: {
          create: {
            name: `Workspace de ${name}`,
          },
        },
      },
    });

    return NextResponse.json(
      { message: "Usuário criado com sucesso", user: { id: user.id, name: user.name, email: user.email } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao registrar:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
