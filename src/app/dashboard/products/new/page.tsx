"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BotOption = { id: string; name: string; username: string | null };

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBotId = searchParams.get("botId") || "";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [billingType, setBillingType] = useState<"one_time" | "recurring">("one_time");
  const [recurringInterval, setRecurringInterval] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [botId, setBotId] = useState(initialBotId);
  const [offerType, setOfferType] = useState<"access" | "product">("access");
  const [accessType, setAccessType] = useState<"group" | "channel">("group");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [isOrderBumpOnly, setIsOrderBumpOnly] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [bots, setBots] = useState<BotOption[]>([]);
  const [error, setError] = useState("");

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
    setError("");

    try {
      const res = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          description, 
          price: parseFloat(price), 
          discountPercent: Number(discountPercent),
          billingType,
          recurringInterval,
          botId, 
          deliveryType: offerType === "access" ? accessType : "file",
          telegramChatId: offerType === "access" ? telegramChatId : null,
          content: offerType === "product" ? externalUrl : null,
          durationDays: offerType === "access" && durationDays ? Number(durationDays) : null,
          isOrderBumpOnly,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao criar produto");
      
      router.push("/dashboard/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar produto.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Novo Produto</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Venda</CardTitle>
          <CardDescription>Cadastre um acesso do Telegram ou um produto entregue por link externo.</CardDescription>
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

            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="discount-percent">Desconto (%)</Label>
              <Input id="discount-percent" type="number" min="0" max="90" step="1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} required />
              <p className="text-xs text-slate-500">O preço promocional será calculado sobre o preço informado.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billing-type">Tipo de cobrança</Label>
                <select id="billing-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={billingType} onChange={(event) => setBillingType(event.target.value as "one_time" | "recurring")}>
                  <option value="one_time">Única (PIX avulso)</option>
                  <option value="recurring">Recorrente / assinatura</option>
                </select>
              </div>

              {billingType === "recurring" && (
                <div className="space-y-2">
                  <Label htmlFor="recurring-interval">Frequência</Label>
                  <select id="recurring-interval" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={recurringInterval} onChange={(event) => setRecurringInterval(event.target.value as "monthly" | "quarterly" | "yearly")}>
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              )}
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

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">O que será vendido?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${offerType === "access" ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}>
                  <input type="radio" name="offer-type" value="access" checked={offerType === "access"} onChange={() => setOfferType("access")} className="mt-1 accent-blue-700" />
                  <span><span className="block font-semibold">Acesso Telegram</span><span className="text-xs text-slate-500">Grupo ou canal seu</span></span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${offerType === "product" ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}>
                  <input type="radio" name="offer-type" value="product" checked={offerType === "product"} onChange={() => setOfferType("product")} className="mt-1 accent-blue-700" />
                  <span><span className="block font-semibold">Produto externo</span><span className="text-xs text-slate-500">Link entregue após o pagamento</span></span>
                </label>
              </div>
            </fieldset>

            {offerType === "access" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="access-type">Tipo de acesso</Label>
                  <select id="access-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={accessType} onChange={(event) => setAccessType(event.target.value as "group" | "channel")}>
                    <option value="group">Grupo do Telegram</option>
                    <option value="channel">Canal do Telegram</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chatId">ID do grupo/canal</Label>
                  <Input id="chatId" placeholder="Ex: -100123456789" value={telegramChatId} onChange={(event) => setTelegramChatId(event.target.value)} required />
                  <p className="text-xs text-slate-500">O bot precisa ser administrador e ter permissão para convidar usuários.</p>
                </div>
                <div className="space-y-2 sm:max-w-xs">
                  <Label htmlFor="duration-days">Duração do acesso em dias</Label>
                  <Input id="duration-days" type="number" min="1" step="1" placeholder="Em branco para vitalício" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="external-url">Link externo entregue após o pagamento</Label>
                <Input id="external-url" type="url" inputMode="url" placeholder="https://exemplo.com/produto" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} required />
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3">
              <input type="checkbox" checked={isOrderBumpOnly} onChange={(event) => setIsOrderBumpOnly(event.target.checked)} className="mt-1 size-4 accent-blue-700" />
              <span><span className="block font-semibold">Somente order bump</span><span className="text-xs text-slate-500">Não aparece na lista inicial do bot; só é oferecido como adicional.</span></span>
            </label>

            {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? "Salvando..." : isOrderBumpOnly ? "Criar oferta de order bump" : "Criar oferta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
