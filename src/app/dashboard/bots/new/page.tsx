"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewBotPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/bots/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, token }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erro ao conectar bot");
      }

      setSuccess("Bot conectado com sucesso! O atendimento será ativado automaticamente.");
      setTimeout(() => {
        router.push("/dashboard/bots");
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao conectar o bot.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Conectar Novo Bot</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Credenciais do BotFather</CardTitle>
          <CardDescription>
            Acesse o @BotFather no Telegram, crie um novo bot e cole o Token de acesso abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome de identificação (apenas para você)</Label>
              <Input
                id="name"
                placeholder="Meu Bot de Vendas VIP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">Bot Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="1234567890:ABCdefGHIjklmNOPqrstUVwxyZ"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>

            {error && <div className="text-red-500 text-sm font-medium p-3 bg-red-50 rounded-md">{error}</div>}
            {success && <div className="text-green-600 text-sm font-medium p-3 bg-green-50 rounded-md">{success}</div>}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? "Validando e Conectando..." : "Conectar Bot"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
