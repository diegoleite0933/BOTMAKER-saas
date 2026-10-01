import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/account-security";
import { AdminConsole } from "./AdminConsole";

const prisma = new PrismaClient();

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !isAdminEmail(session.user?.email) || !userId) redirect("/dashboard");

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
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { cpf: true } });

  return <AdminConsole initialUsers={users} initialCpf={admin?.cpf || ""} />;
}