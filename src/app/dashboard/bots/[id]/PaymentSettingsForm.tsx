"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaymentSettingsForm({ 
  botId, 
  initialMethod, 
  initialPix, 
  initialMpToken,
  initialAmploId,
  initialAmploSecret
}: { 
  botId: string, 
  initialMethod: string, 
  initialPix: string | null, 
  initialMpToken: string | null,
  initialAmploId: string | null,
  initialAmploSecret: string | null
}) {
  const [method, setMethod] = useState(initialMethod);
  const [pixKey, setPixKey] = useState(initialPix || "");
  const [mpToken, setMpToken] = useState(initialMpToken || "");
  const [amplopayId, setAmplopayId] = useState(initialAmploId || "");
  const [amplopaySecret, setAmplopaySecret] = useState(initialAmploSecret || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function saveSettings() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/bots/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, method, pixKey, mpToken, amplopayId, amplopaySecret })
      });
      if (res.ok) {
        setMessage("Configurações salvas com sucesso!");
      } else {
        setMessage("Erro ao salvar.");
      }
    } catch (e) {
      setMessage("Erro de conexão.");
    }
    setLoading(false);
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Método de Pagamento</CardTitle>
        <CardDescription>Configure como você quer receber as vendas deste bot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <label className={`flex-1 border rounded-lg p-4 cursor-pointer flex flex-col items-center justify-center gap-2 ${method === 'mercadopago' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
            <input type="radio" name="paymentMethod" value="mercadopago" checked={method === 'mercadopago'} onChange={() => setMethod('mercadopago')} className="hidden" />
            <span className="font-semibold text-blue-700">Mercado Pago</span>
            <span className="text-xs text-center text-slate-500">Gateway 100% Automático</span>
          </label>
          <label className={`flex-1 border rounded-lg p-4 cursor-pointer flex flex-col items-center justify-center gap-2 ${method === 'amplopay' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
            <input type="radio" name="paymentMethod" value="amplopay" checked={method === 'amplopay'} onChange={() => setMethod('amplopay')} className="hidden" />
            <span className="font-semibold text-indigo-700">Amplo Pay</span>
            <span className="text-xs text-center text-slate-500">Gateway via API</span>
          </label>
          <label className={`flex-1 border rounded-lg p-4 cursor-pointer flex flex-col items-center justify-center gap-2 ${method === 'pix_direto' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
            <input type="radio" name="paymentMethod" value="pix_direto" checked={method === 'pix_direto'} onChange={() => setMethod('pix_direto')} className="hidden" />
            <span className="font-semibold text-green-700">Pix Direto</span>
            <span className="text-xs text-center text-slate-500">Receba no seu banco</span>
          </label>
        </div>

        {method === 'pix_direto' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <Label>Sua Chave PIX</Label>
            <Input value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Ex: 049.286.572-94 ou seu@email.com" />
            <p className="text-xs text-slate-500">O robô gerará o código Pix pedindo ao cliente que deposite nesta chave exata.</p>
          </div>
        )}

        {method === 'amplopay' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <Label>Amplo Pay - Public Key (Client ID)</Label>
              <Input value={amplopayId} onChange={e => setAmplopayId(e.target.value)} placeholder="Ex: diegobrota_..." />
            </div>
            <div className="space-y-2">
              <Label>Amplo Pay - Secret Key</Label>
              <Input value={amplopaySecret} onChange={e => setAmplopaySecret(e.target.value)} placeholder="Ex: 8ej5nonxf..." type="password" />
            </div>
            <p className="text-xs text-slate-500">Gere essas chaves no painel da Amplo Pay em Integrações.</p>
          </div>
        )}
        {method === 'mercadopago' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <Label>Access Token (Produção)</Label>
            <Input value={mpToken} onChange={e => setMpToken(e.target.value)} placeholder="APP_USR-..." type="password" />
            <p className="text-xs text-slate-500">Gere este token no painel de desenvolvedores do Mercado Pago.</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <span className="text-sm text-green-600">{message}</span>
        <Button onClick={saveSettings} disabled={loading}>{loading ? "Salvando..." : "Salvar Pagamento"}</Button>
      </CardFooter>
    </Card>
  );
}
