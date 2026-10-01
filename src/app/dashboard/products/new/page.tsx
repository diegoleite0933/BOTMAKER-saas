"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBotId = searchParams.get("botId") || "";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [botId, setBotId] = useState(initialBotId);
  const [telegramChatId, setTelegramChatId] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [bots, setBots] = useState<any[]>([]);

  useEffect(() => {
    // Fetch user bots
    fetch("/api/bots")
      .then(res => res.json())
      .then(data => setBots(data.bots || []))
      .catch(console.error);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          description, 
          price: parseFloat(price), 
          botId, 
          telegramChatId 
        }),
      });

      if (!res.ok) throw new Error("Erro ao criar produto");
      
      router.push("/dashboard/products");
    } catch (err) {
      console.error(err);
      alert("Erro ao criar produto.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Novo Produto</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Venda</CardTitle>
          <CardDescription>
            Configure o que será vendido, o valor e como o bot entregará o acesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-6">
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto</Label>
                <Input
                  id="name"
                  placeholder="Ex: Acesso VIP Mensal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$ PIX)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="29.90"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição para o Usuário</Label>
              <Textarea
                id="description"
                placeholder="Esta descrição aparecerá no bot quando o usuário clicar no produto."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bot">Qual Bot fará a venda?</Label>
              <select 
                id="bot"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={botId}
                onChange={(e) => setBotId(e.target.value)}
                required
              >
                <option value="" disabled>Selecione um bot</option>
                {bots.map(b => (
                  <option key={b.id} value={b.id}>{b.name} (@{b.username})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chatId">ID do Grupo/Canal (Entrega)</Label>
              <Input
                id="chatId"
                placeholder="Ex: -100123456789"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                O bot precisa ser administrador deste grupo/canal. Use o ID (começa com -100).
              </p>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? "Salvando..." : "Criar Produto"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
