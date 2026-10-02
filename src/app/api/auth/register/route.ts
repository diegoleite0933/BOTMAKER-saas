import { NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { normalizeCpf, normalizeNickname } from "@/lib/account-security";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { name, nickname, email, password, cpf } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedNickname = normalizeNickname(nickname);
    const normalizedCpf = normalizeCpf(cpf);

    if (typeof name !== "string" || !name.trim() || !normalizedNickname || !normalizedEmail || typeof password !== "string" || !password || !normalizedCpf) {
      return NextResponse.json(
        { message: "Informe nome, apelido válido, e-mail, senha e um CPF válido." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const result = await prisma.$transaction(async (transaction) => {
        const existingUser = await transaction.user.findFirst({
          where: {
            OR: [
              { email: normalizedEmail },
              { cpf: normalizedCpf },
              { nickname: { equals: normalizedNickname, mode: "insensitive" } },
            ],
          },
        });

        if (existingUser) {
          return {
            conflict: existingUser.email === normalizedEmail
              ? "E-mail já cadastrado"
              : existingUser.cpf === normalizedCpf
                ? "CPF já cadastrado"
                : "Apelido já cadastrado",
          };
        }

        const user = await transaction.user.create({
          data: {
            name,
            nickname: normalizedNickname,
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
        return { user };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if ("conflict" in result) {
        return NextResponse.json({ message: result.conflict }, { status: 400 });
      }

      return NextResponse.json(
        { message: "Usuário criado com sucesso", user: { id: result.user.id, name: result.user.name, email: result.user.email } },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        return NextResponse.json({ message: "E-mail, CPF ou apelido já cadastrado. Tente novamente." }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Erro ao registrar:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
