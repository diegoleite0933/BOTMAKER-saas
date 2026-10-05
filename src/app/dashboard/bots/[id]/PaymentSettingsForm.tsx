"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaymentSettingsForm({
  botId,
  initialMethod,
  initialPixReviewChatId,
}: {
  botId: string;
  initialMethod: string;
  initialPixReviewChatId: string | null;
}) {
  const [method, setMethod] = useState(initialMethod);
  const [pixReviewChatId, setPixReviewChatId] = useState(initialPixReviewChatId || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveSettings() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/bots/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, method, pixReviewChatId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Não foi possível salvar as configurações.");
      setMessage("Configurações salvas com sucesso.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Gateway deste bot</CardTitle>
        <CardDescription>Escolha qual integração centralizada será usada por este bot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor={`payment-method-${botId}`}>Gateway de pagamento</Label>
          <select id={`payment-method-${botId}`} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="mercadopago">Mercado Pago</option>
            <option value="amplopay">AmploPay</option>
            <option value="pix_direto">PIX Direto, com revisão manual</option>
          </select>
          <p className="text-xs text-slate-500">As credenciais são gerenciadas centralmente e não aparecem nesta tela.</p>
        </div>

        {method === "pix_direto" && (
          <div className="space-y-2">
            <Label htmlFor={`pix-review-chat-${botId}`}>Grupo de revisão de comprovantes (opcional)</Label>
            <Input id={`pix-review-chat-${botId}`} value={pixReviewChatId} onChange={(event) => setPixReviewChatId(event.target.value)} placeholder="ID do grupo" />
            <p className="text-xs text-slate-500">O PIX Direto usa conferência manual. Adicione o bot como administrador do grupo para encaminhar os comprovantes.</p>
          </div>
        )}

        <Link href="/dashboard/integrations" className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-500">Gerenciar credenciais em Integrações</Link>
      </CardContent>
      <CardFooter className="flex justify-between">
        <span aria-live="polite" className={`text-sm ${error ? "text-red-600" : "text-green-600"}`}>{error || message}</span>
        <Button type="button" onClick={saveSettings} disabled={loading}>{loading ? "Salvando..." : "Salvar gateway"}</Button>
      </CardFooter>
    </Card>
  );
}
