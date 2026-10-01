"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BotOption = { id: string; name: string; username: string };
type Delivery = {
  type: string;
  telegramChatId: string | null;
  content: string | null;
  durationDays: number | null;
} | null;

export function ProductEditor({
  bots,
  product,
}: {
  bots: BotOption[];
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    status: string;
    botId: string;
    delivery: Delivery;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(String(product.price));
  const [botId, setBotId] = useState(product.botId);
  const [status, setStatus] = useState(product.status);
  const [deliveryType, setDeliveryType] = useState(product.delivery?.type || "group");
  const [telegramChatId, setTelegramChatId] = useState(product.delivery?.telegramChatId || "");
  const [content, setContent] = useState(product.delivery?.content || "");
  const [durationDays, setDurationDays] = useState(product.delivery?.durationDays?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price: Number(price),
          botId,
          status,
          deliveryType,
          telegramChatId,
          content,
          durationDays: durationDays ? Number(durationDays) : null,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Não foi possível salvar o produto.");
      }

      router.push("/dashboard/products");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar o produto.");
      setLoading(false);
    }
  }

  const usesChatId = deliveryType === "group" || deliveryType === "channel";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-4 border-b border-slate-200 pb-6">
        <Link href="/dashboard/products" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft aria-hidden="true" className="size-4" /> Voltar para produtos
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Catálogo / Edição</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Editar produto</h1>
          <p className="mt-1 text-sm text-slate-600">Atualize a oferta, o bot responsável e as regras de entrega.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Informações do produto</CardTitle>
            <CardDescription>Esses dados aparecem na oferta do bot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-name">Nome</Label>
                <Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-price">Preço (R$)</Label>
                <Input id="product-price" type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Descrição</Label>
              <Textarea id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-bot">Bot responsável</Label>
                <select id="product-bot" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={botId} onChange={(event) => setBotId(event.target.value)} required>
                  {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name} (@{bot.username})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-status">Disponibilidade</Label>
                <select id="product-status" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="active">Ativo, disponível para venda</option>
                  <option value="inactive">Inativo, oculto no bot</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Entrega</CardTitle>
            <CardDescription>Configure o que o cliente recebe após o pagamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-2">
              <Label htmlFor="delivery-type">Tipo de entrega</Label>
              <select id="delivery-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={deliveryType} onChange={(event) => setDeliveryType(event.target.value)}>
                <option value="group">Grupo do Telegram</option>
                <option value="channel">Canal do Telegram</option>
                <option value="file">Link de arquivo</option>
                <option value="text">Texto ou instruções</option>
              </select>
            </div>
            {usesChatId ? (
              <div className="space-y-2">
                <Label htmlFor="delivery-chat">ID do grupo/canal</Label>
                <Input id="delivery-chat" value={telegramChatId} onChange={(event) => setTelegramChatId(event.target.value)} placeholder="Ex: -100123456789" required />
                <p className="text-xs text-slate-500">O bot precisa ser administrador do grupo ou canal.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="delivery-content">{deliveryType === "file" ? "Link do arquivo" : "Conteúdo entregue"}</Label>
                <Textarea id="delivery-content" value={content} onChange={(event) => setContent(event.target.value)} rows={4} required />
              </div>
            )}
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="delivery-duration">Duração do acesso em dias</Label>
              <Input id="delivery-duration" type="number" min="1" step="1" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} placeholder="Em branco para vitalício" />
            </div>
          </CardContent>
        </Card>

        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/dashboard/products" className={buttonVariants({ variant: "outline" })}>Cancelar</Link>
          <Button type="submit" disabled={loading} className="gap-2 bg-blue-700 text-white hover:bg-blue-800">
            <Save aria-hidden="true" /> {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </div>
  );
}