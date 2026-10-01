"use client";

import { useState } from "react";
import { Search, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  cpf: string | null;
  isBanned: boolean;
  createdAt: string | Date;
  _count: { workspaces: number };
};

function formatCpf(value: string | null) {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}` : "Cadastrado";
}

export function AdminConsole({ initialUsers, initialCpf }: { initialUsers: AdminUser[]; initialCpf: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [cpf, setCpf] = useState(initialCpf);
  const [query, setQuery] = useState("");
  const [savingCpf, setSavingCpf] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const filteredUsers = users.filter((user) =>
    `${user.name || ""} ${user.email || ""} ${user.cpf || ""}`.toLowerCase().includes(query.toLowerCase())
  );

  async function saveCpf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCpf(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar o CPF.");
      setNotice("CPF salvo. Você também poderá entrar com esse CPF.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar o CPF.");
    } finally {
      setSavingCpf(false);
    }
  }

  async function toggleBan(user: AdminUser) {
    setBusyUserId(user.id);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isBanned: !user.isBanned }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível atualizar a conta.");
      setUsers((current) => current.map((entry) => entry.id === user.id ? { ...entry, isBanned: !user.isBanned } : entry));
      setNotice(result.message);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Erro ao atualizar a conta.");
    } finally {
      setBusyUserId(null);
    }
  }

  const bannedCount = users.filter((user) => user.isBanned).length;

  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Acesso restrito</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Administração</h1>
        <p className="text-sm text-slate-600">Contas cadastradas e controle de acesso.</p>
      </header>

      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Seu CPF de acesso</CardTitle>
          <CardDescription>Você pode entrar usando seu e-mail ou o CPF cadastrado.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={saveCpf} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-2 sm:max-w-xs">
              <Label htmlFor="admin-cpf">CPF</Label>
              <Input id="admin-cpf" inputMode="numeric" autoComplete="off" maxLength={14} value={cpf} onChange={(event) => setCpf(event.target.value.replace(/\D/g, "").slice(0, 11))} required />
            </div>
            <Button type="submit" disabled={savingCpf}>{savingCpf ? "Salvando..." : "Salvar CPF"}</Button>
          </form>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 divide-x divide-slate-200 border-y border-slate-200 py-4 sm:max-w-md" aria-label="Resumo das contas">
        <div className="pr-6">
          <p className="text-sm text-slate-500">Contas cadastradas</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{users.length}</p>
        </div>
        <div className="pl-6">
          <p className="text-sm text-slate-500">Contas bloqueadas</p>
          <p className="mt-1 text-2xl font-semibold text-rose-700">{bannedCount}</p>
        </div>
      </section>

      {notice && <p role="status" className="text-sm font-medium text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}

      <Card>
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Contas de clientes</CardTitle>
              <CardDescription className="mt-1">Consulte cadastros e controle o acesso dos clientes.</CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input aria-label="Buscar contas" placeholder="Buscar por nome, e-mail ou CPF" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nenhuma conta encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Workspaces</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acesso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="min-w-56">
                        <span className="font-medium text-slate-900">{user.name || "Sem nome"}</span>
                        <span className="mt-1 block text-xs text-slate-500">{user.email || "Sem e-mail"}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">{formatCpf(user.cpf)}</TableCell>
                      <TableCell>{user._count.workspaces}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.isBanned ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>
                          {user.isBanned ? "Bloqueada" : "Ativa"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant={user.isBanned ? "outline" : "destructive"} size="sm" disabled={busyUserId === user.id || user.email?.toLowerCase() === "diegoleite0933@gmail.com"} onClick={() => toggleBan(user)} className="gap-2">
                          {user.isBanned ? <ShieldCheck aria-hidden="true" /> : <ShieldX aria-hidden="true" />}
                          {busyUserId === user.id ? "Salvando..." : user.isBanned ? "Desbloquear" : "Bloquear"}
                        </Button>
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
