import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside className="w-64 border-r bg-slate-950 text-slate-400 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Link className="flex items-center gap-2 font-bold text-white text-xl tracking-tight" href="/dashboard">
            BotMaker<span className="text-blue-500">.io</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors">
            📊 Visão Geral
          </Link>
          <Link href="/dashboard/bots" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors">
            🤖 Meus Bots
          </Link>
          <Link href="/dashboard/products" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors">
            📦 Produtos
          </Link>
          <Link href="/dashboard/sales" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors">
            💸 Vendas
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="text-sm truncate text-slate-300 mb-2">
            👤 {session.user?.name || session.user?.email}
          </div>
          <Link href="/api/auth/signout" className="block w-full text-center px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm transition-colors">
            Desconectar
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 flex items-center px-4 border-b bg-slate-950 justify-between">
          <Link className="font-bold text-white text-xl tracking-tight" href="/dashboard">
            BotMaker<span className="text-blue-500">.io</span>
          </Link>
          <Link href="/api/auth/signout" className="text-sm text-slate-400 hover:text-white">Sair</Link>
        </header>
        <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
