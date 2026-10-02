import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { isAdminEmail, normalizeCpf, normalizeNickname } from "@/lib/account-security";

const prisma = new PrismaClient();
type AccountTokenFields = { id?: string | null; nickname?: string | null; isAdmin?: boolean; isBanned?: boolean };

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "your_nextauth_secret_here",
  adapter: PrismaAdapter(prisma) as unknown as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        nickname: { label: "Apelido", type: "text" },
        email: { label: "E-mail ou CPF", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const nickname = normalizeNickname(credentials?.nickname);
        if (!nickname || !credentials?.email || !credentials?.password) {
          throw new Error("Dados inválidos");
        }

        const identifier = credentials.email.trim();
        const cpf = normalizeCpf(identifier);
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier.toLowerCase() },
              { cpf: cpf || "__invalid_cpf__" },
            ],
          },
        });

        if (!user || !user.password || user.isBanned) {
          throw new Error("Usuário não encontrado");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Senha incorreta");
        }

        if (user.nickname && user.nickname.toLocaleLowerCase("pt-BR") !== nickname.toLocaleLowerCase("pt-BR")) {
          throw new Error("Apelido incorreto");
        }

        if (!user.nickname) {
          try {
            await prisma.$transaction(async (transaction) => {
              const nicknameOwner = await transaction.user.findFirst({
                where: {
                  id: { not: user.id },
                  nickname: { equals: nickname, mode: "insensitive" },
                },
                select: { id: true },
              });
              if (nicknameOwner) throw new Error("Apelido já está em uso");
              await transaction.user.update({ where: { id: user.id }, data: { nickname } });
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
          } catch {
            throw new Error("Não foi possível salvar esse apelido. Tente outro.");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.nickname || nickname,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const accountToken = token as typeof token & AccountTokenFields;
      if (user) {
        accountToken.id = user.id;
      }

      if (typeof accountToken.id === "string") {
        const account = await prisma.user.findUnique({
          where: { id: accountToken.id },
          select: { id: true, email: true, name: true, nickname: true, isBanned: true },
        });

        accountToken.isBanned = !account || account.isBanned;
        accountToken.isAdmin = account ? isAdminEmail(account.email) : false;
        accountToken.nickname = account?.nickname || account?.name || null;
        if (accountToken.nickname) token.name = accountToken.nickname;
        if (!account || account.isBanned) accountToken.id = null;
      }

      return accountToken;
    },
    async session({ session, token }) {
      if (token && session.user) {
        const accountToken = token as typeof token & AccountTokenFields;
        const sessionUser = session.user as typeof session.user & AccountTokenFields;
        sessionUser.id = typeof accountToken.id === "string" ? accountToken.id : null;
        sessionUser.nickname = accountToken.nickname || null;
        sessionUser.name = accountToken.nickname || sessionUser.name;
        sessionUser.isAdmin = accountToken.isAdmin === true;
        sessionUser.isBanned = accountToken.isBanned === true;
      }
      return session;
    },
  },
};
