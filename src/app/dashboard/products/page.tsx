import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { Package, Plus } from "lucide-react";

const prisma = new PrismaClient();

export default async function ProductsPage() {
  const session = await getServerSession(authOptions);

  const workspace = await prisma.workspace.findFirst({
    where: { userId: session?.user?.id }
  });

  const products = await prisma.product.findMany({
    where: {
      bot: { workspaceId: workspace?.id }
    },
    include: { bot: true },
    orderBy: { createdAt: 'desc' }
  });
  const activeProducts = products.filter((product) => product.status === "active").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Catálogo</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Meus Produtos</h1>
          <p className="max-w-xl text-sm text-slate-600">Gerencie ofertas, valores e entregas dos seus bots.</p>
        </div>
        <Link href="/dashboard/products/new" className={buttonVariants({ className: "gap-2 bg-blue-700 text-white hover:bg-blue-800" })}>
          <Plus aria-hidden="true" /> Novo produto
        </Link>
      </div>

      <section aria-label="Resumo de produtos" className="grid grid-cols-2 divide-x divide-slate-200 border-y border-slate-200 py-4 sm:max-w-md">
        <div className="pr-6">
          <p className="text-sm text-slate-500">Produtos cadastrados</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{products.length}</p>
        </div>
        <div className="pl-6">
          <p className="text-sm text-slate-500">Disponíveis para venda</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{activeProducts}</p>
        </div>
      </section>

      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Catálogo de vendas</CardTitle>
          <CardDescription>Produtos e bots vinculados nesta conta.</CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-4 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Package aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium text-slate-900">Seu catálogo está vazio</p>
                <p className="mt-1 text-sm text-slate-500">Cadastre um produto para começar a vender pelo Telegram.</p>
              </div>
              <Link href="/dashboard/products/new" className={buttonVariants({ variant: "outline", className: "mt-1" })}>Criar primeiro produto</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Bot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="min-w-52">
                      <span className="font-medium text-slate-900">{product.name}</span>
                      {product.description && <span className="mt-1 block max-w-sm truncate text-xs text-slate-500">{product.description}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium text-slate-900">
                      {product.discountPercent > 0 ? (
                        <>
                          <span className="block">R$ {(product.price * (1 - product.discountPercent / 100)).toFixed(2)}</span>
                          <span className="text-xs text-slate-500 line-through">R$ {product.price.toFixed(2)} · -{product.discountPercent}%</span>
                        </>
                      ) : `R$ ${product.price.toFixed(2)}`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      <span className="block">{product.bot.name}</span>
                      <span className="text-xs text-slate-500">@{product.bot.username}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${product.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        <span className={`size-1.5 rounded-full ${product.status === "active" ? "bg-emerald-600" : "bg-slate-400"}`} />
                        {product.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/products/${product.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Editar produto</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
