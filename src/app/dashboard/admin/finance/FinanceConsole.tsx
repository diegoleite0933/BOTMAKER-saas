"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FeeEntry = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantNickname: string | null;
  saleId: string;
  saleStatus: string;
  saleAmountCents: number;
  gateway: string;
  providerTransactionId: string;
  entryType: string;
  feeAmountCents: number;
  currency: string;
  status: string;
  providerReference: string | null;
  failureReason: string | null;
  paidAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  events: { eventType: string; fromStatus: string | null; toStatus: string; reference: string | null; createdAt: string }[];
};

type FinanceResponse = {
  config: { enabled: boolean; type: string; amountCents: number; currency: string; exemptGateway: string };
  summary: { pendingCents: number; receivedCents: number; failedCents: number; waivedCount: number; generatedCents: number; feeEntries: number; refundAdjustmentCents: number; paidSalesCount: number; paidSalesAmountCents: number; averagePaidSaleCents: number };
  tenants: { id: string; name: string; user: { email: string | null; nickname: string | null } }[];
  entries: FeeEntry[];
};

type ReceivingAccount = { configured: boolean; status: string; redirectUri: string; lastValidatedAt: string | null };

const gatewayNames: Record<string, string> = {
  mercadopago: "Mercado Pago",
  amplopay: "AmploPay",
  pix_direto: "PIX Direto",
  syncpay: "SyncPay",
  pushinpay: "Pushin Pay",
  atomopay: "Átomo Pay",
  nexuswallet: "Nexus Wallet",
  stripe: "Stripe",
  oasypay: "Oasy Pay",
};

const splitStates = [
  ["Mercado Pago", "Disponível via Marketplace 1:1 após app da plataforma e OAuth do tenant."],
  ["AmploPay", "Sem suporte a split fixo confirmado; ledger PENDING."],
  ["SyncPay", "Documentação consultada sem split cash-in confirmado; ledger PENDING."],
  ["PIX Direto", "Isento; não gera lançamento financeiro de taxa."],
  ["Pushin Pay, Átomo Pay, Nexus Wallet, Stripe e Oasy Pay", "Ainda não integrados ao checkout; sem cobrança ou split."],
];

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

export function FinanceConsole() {
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [receivingAccount, setReceivingAccount] = useState<ReceivingAccount | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"mercadopago" | "syncpay">("syncpay");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [gateway, setGateway] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAccount(provider: "mercadopago" | "syncpay" = selectedProvider) {
    const response = await fetch(`/api/admin/platform-fees/receiving-account?provider=${provider}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Não foi possível carregar a conta recebedora.");
    setReceivingAccount(result);
  }

  async function loadLedger() {
    const params = new URLSearchParams();
    if (tenantId) params.set("tenantId", tenantId);
    if (gateway) params.set("gateway", gateway);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const response = await fetch(`/api/admin/platform-fees?${params}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Não foi possível carregar o ledger.");
    setData(result);
  }

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try {
        const [accountResponse, ledgerResponse] = await Promise.all([
          fetch(`/api/admin/platform-fees/receiving-account?provider=${selectedProvider}`, { cache: "no-store" }),
          fetch("/api/admin/platform-fees", { cache: "no-store" }),
        ]);
        const [account, ledger] = await Promise.all([accountResponse.json(), ledgerResponse.json()]);
        if (!accountResponse.ok || !ledgerResponse.ok) throw new Error("Não foi possível carregar os dados financeiros.");
        if (active) {
          setReceivingAccount(account);
          setData(ledger);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Erro ao carregar dados financeiros.");
      }
    };
    void loadInitial();
    return () => { active = false; };
  }, [selectedProvider]);

  async function saveReceivingAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/platform-fees/receiving-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, clientId, clientSecret, webhookSecret }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar a conta.");
      setClientId("");
      setClientSecret("");
      setWebhookSecret("");
      setMessage(result.message);
      await loadAccount(selectedProvider);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar as credenciais.");
    } finally {
      setBusy(false);
    }
  }

  const summary = data?.summary;
  return (
    <div className="space-y-6">
      <header className="space-y-2 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Administração financeira</p>
        <h1 className="text-3xl font-bold text-slate-950">Taxas da plataforma</h1>
        <p className="text-sm text-slate-600">Ledger auditável por tenant, venda, gateway e transação.</p>
      </header>

      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo financeiro">
        {[
          ["Taxa atual", data ? money(data.config.amountCents) : "—", "FIXA · BRL"],
          ["Vendas pagas", summary ? String(summary.paidSalesCount) : "—", summary ? money(summary.paidSalesAmountCents) : "Total BRL"],
          ["Ticket médio", summary ? money(summary.averagePaidSaleCents) : "—", "Vendas pagas no período"],
          ["Taxas geradas", summary ? money(summary.generatedCents) : "—", "Inclui taxas posteriormente reembolsadas"],
          ["Taxas pendentes", summary ? money(summary.pendingCents) : "—", "Aguardando split ou recebimento"],
          ["Taxas recebidas", summary ? money(summary.receivedCents) : "—", "Confirmadas pelo gateway"],
          ["Taxas falhadas", summary ? money(summary.failedCents) : "—", "Exigem revisão"],
          ["Vendas isentas", summary ? String(summary.waivedCount) : "—", "PIX Direto"],
        ].map(([title, value, detail]) => (
          <Card key={title} className="rounded-md border-slate-200">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{title}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-md border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Conta de recebimento da plataforma</CardTitle>
          <CardDescription>Credenciais separadas das contas dos tenants. Segredos são cifrados no servidor e nunca devolvidos ao navegador.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3 text-sm">
            <p>Status: <strong>{receivingAccount?.configured ? "CONFIGURADA" : "NÃO CONFIGURADA"}</strong></p>
            <p>Gateway atual: <strong>{selectedProvider === "syncpay" ? "SyncPay" : "Mercado Pago Marketplace"}</strong></p>
            <p className="break-all">Redirect URI: <code>{selectedProvider === "syncpay" ? "Configuração manual (Client ID / Secret)" : receivingAccount?.redirectUri || "Carregando…"}</code></p>
            <p className="text-xs text-slate-500">{selectedProvider === "syncpay"
              ? "Para a SyncPay, as credenciais são informadas manualmente e validadas pelo endpoint de autenticação do gateway."
              : "Split 1:1 também depende de aprovação/habilitação da aplicação Marketplace e do OAuth individual do tenant."}</p>
          </div>
          <form onSubmit={saveReceivingAccount} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="platform-receiving-provider">Gateway da conta recebedora</Label>
              <select id="platform-receiving-provider" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value as "mercadopago" | "syncpay")}>
                <option value="syncpay">SyncPay</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platform-client-id">Client ID / APP ID</Label>
              <Input id="platform-client-id" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder={receivingAccount?.configured ? "Mantido se vazio" : selectedProvider === "syncpay" ? "Client ID da SyncPay" : "APP ID da aplicação Marketplace"} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platform-client-secret">Client Secret</Label>
              <Input id="platform-client-secret" type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder={receivingAccount?.configured ? "Mantido se vazio" : selectedProvider === "syncpay" ? "Client Secret da SyncPay" : "Secret Key da aplicação Marketplace"} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="platform-webhook-secret">Webhook secret (opcional)</Label>
              <Input id="platform-webhook-secret" type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder={selectedProvider === "syncpay" ? "Opcional; a validação usa o client secret do gateway" : "Mantido se vazio; webhook ainda consulta a API oficial"} autoComplete="new-password" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar credenciais da plataforma"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-md border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Split por gateway</CardTitle>
          <CardDescription>Split só é exibido como recebido quando a confirmação do provider corresponde ao valor fixo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 pt-4 sm:grid-cols-2">
          {splitStates.map(([name, description]) => (
            <div key={name} className="border-b border-slate-100 py-2 text-sm">
              <p className="font-medium text-slate-900">{name}</p>
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-md border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Histórico de taxas</CardTitle>
          <CardDescription>Conta da venda e do ajuste permanecem separadas para auditoria.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1"><Label htmlFor="fee-from">De</Label><Input id="fee-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="fee-to">Até</Label><Input id="fee-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="fee-tenant">Tenant</Label><select id="fee-tenant" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={tenantId} onChange={(event) => setTenantId(event.target.value)}><option value="">Todos</option>{data?.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.user.nickname || tenant.user.email}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="fee-gateway">Gateway</Label><select id="fee-gateway" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={gateway} onChange={(event) => setGateway(event.target.value)}><option value="">Todos</option>{Object.entries(gatewayNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="fee-status">Status</Label><select id="fee-status" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option>{["PENDING", "PROCESSING", "RECEIVED", "FAILED", "REFUNDED", "WAIVED"].map((value) => <option key={value}>{value}</option>)}</select></div>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadLedger()}>Aplicar filtros</Button>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente / tenant</TableHead><TableHead>Venda</TableHead><TableHead>Gateway / transação</TableHead><TableHead>Taxa</TableHead><TableHead>Status</TableHead><TableHead>Gerada em</TableHead><TableHead>Recebida em</TableHead></TableRow></TableHeader>
              <TableBody>
                {data?.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="min-w-48"><span className="font-medium">{entry.tenantNickname || entry.tenantName}</span><span className="block text-xs text-slate-500">{entry.tenantEmail || entry.tenantId}</span></TableCell>
                    <TableCell className="min-w-32"><span className="font-mono text-xs">{entry.saleId}</span><span className="block text-xs text-slate-500">{money(entry.saleAmountCents)}</span></TableCell>
                    <TableCell className="min-w-48">{gatewayNames[entry.gateway] || entry.gateway}<span className="block break-all font-mono text-xs text-slate-500">{entry.providerTransactionId}</span>{entry.providerReference && <span className="block break-all text-xs text-slate-500">Ref: {entry.providerReference}</span>}</TableCell>
                    <TableCell className="whitespace-nowrap">{money(entry.feeAmountCents)}</TableCell>
                    <TableCell>{entry.status}<span className="block text-xs text-slate-500">{entry.entryType}</span>{entry.failureReason && <span className="block text-xs text-rose-600">{entry.failureReason}</span>}{entry.events.map((event, index) => <span key={`${event.eventType}-${index}`} className="block text-xs text-slate-500">{event.fromStatus ? `${event.fromStatus} → ` : ""}{event.toStatus} · {timestamp(event.createdAt)}</span>)}</TableCell>
                    <TableCell className="whitespace-nowrap">{timestamp(entry.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{timestamp(entry.receivedAt)}</TableCell>
                  </TableRow>
                ))}
                {data?.entries.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500">Nenhum lançamento encontrado para os filtros.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}