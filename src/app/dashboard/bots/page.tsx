import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const prisma = new PrismaClient();

export default async function BotsPage() {
  const session = await getServerSession(authOptions);
  
  const workspace = await prisma.workspace.findFirst({
    where: { userId: session?.user?.id }
  });

  const bots = await prisma.bot.findMany({
    where: { workspaceId: workspace?.id },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Meus Bots</h1>
          <p className="text-slate-500">Gerencie todos os seus bots conectados.</p>
        </div>
        <Link href="/dashboard/bots/new" className={buttonVariants({ className: "bg-blue-600 hover:bg-blue-700 text-white" })}>+ Conectar Bot</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bots Conectados</CardTitle>
          <CardDescription>
            Você tem {bots.length} bot(s) ativo(s) nesta conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 space-y-4">
              <p className="text-slate-500 text-sm">Nenhum bot encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Username (Telegram)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bots.map((bot) => (
                  <TableRow key={bot.id}>
                    <TableCell className="font-medium">{bot.name}</TableCell>
                    <TableCell>@{bot.username}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                        {bot.status === 'active' ? 'Ativo' : bot.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(bot.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "h-8 w-8 p-0" })}>
                          <span className="sr-only">Abrir menu</span>
                          ...
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Link href={`/dashboard/bots/${bot.id}`} className="w-full">Configurar</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Link href={`/dashboard/products?botId=${bot.id}`} className="w-full">Ver Produtos</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            Desconectar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
