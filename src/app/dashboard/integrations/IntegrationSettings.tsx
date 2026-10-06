"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, CreditCard, ExternalLink, KeyRound, LoaderCircle, PlugZap, Save, ShieldCheck, Trash2, X } from "lucide-react";

type Provider = {
  id: string;
  name: string;
  description: string;
  status: "available" | "coming-soon";
  testable: boolean;
  configured: boolean;
  configuredCentrally: boolean;
  legacyBotCount: number;
  environmentFallback: boolean;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  marketplaceReady?: boolean;
  marketplaceConnected?: boolean;
};

type CredentialField = { key: string; label: string; placeholder: string; description?: string };

const credentialFields: Record<string, CredentialField[]> = {
  mercadopago: [
    { key: "accessToken", label: "Access Token", placeholder: "APP_USR-…", description: "Token privado de produção da sua aplicação Mercado Pago." },
  ],
  amplopay: [
    { key: "clientId", label: "Client ID / Public Key", placeholder: "Client ID da AmploPay" },
    { key: "clientSecret", label: "Client Secret", placeholder: "Secret Key da AmploPay" },
  ],
  pix_direto: [
    { key: "pixKey", label: "Chave PIX", placeholder: "Sua chave PIX cadastrada no banco", description: "A conferência do pagamento permanece manual no grupo de revisão do bot." },
  ],
  syncpay: [
    { key: "clientId", label: "Client ID", placeholder: "Client ID da sua conta SyncPay", description: "Identificador público da conta do cliente." },
    { key: "clientSecret", label: "Client Secret", placeholder: "Client Secret da sua conta SyncPay", description: "Segredo da aplicação; nunca é exibido no frontend." },
  ],
};

function statusText(provider: Provider) {
  if (provider.status === "coming-soon") return "Em breve";
  if (provider.lastTestStatus === "success") return "Conectado";
  if (provider.environmentFallback) return "Disponível por variável de ambiente";
  if (provider.configuredCentrally) return provider.testable ? "Credenciais salvas, não testadas" : "Credenciais salvas";
  if (provider.legacyBotCount) return `Ativo em ${provider.legacyBotCount} ${provider.legacyBotCount === 1 ? "bot" : "bots"} (legado)`;
  return "Desconectado";
}

function statusClass(provider: Provider) {
  if (provider.status === "coming-soon") return "border-[#303030] bg-[#141414] text-[#999]";
  if (provider.lastTestStatus === "success") return "border-[#16452f] bg-[#0b1f14] text-[#61d49a]";
  if (provider.configured || provider.environmentFallback) return "border-[#55401c] bg-[#211a0e] text-[#f0bd67]";
  return "border-[#303030] bg-[#141414] text-[#999]";
}

export function IntegrationSettings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadProviders() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/integrations", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível carregar as integrações.");
      setProviders(result.integrations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as integrações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProviders(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function beginEdit(provider: Provider) {
    setNotice("");
    setError("");
    setEditingProvider(provider.id);
    setCredentials({});
  }

  async function save(provider: Provider) {
    setBusyProvider(provider.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, credentials }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar as credenciais.");
      setEditingProvider(null);
      setCredentials({});
      setNotice(result.message);
      await loadProviders();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar a integração.");
    } finally {
      setBusyProvider(null);
    }
  }

  async function test(provider: Provider) {
    setBusyProvider(provider.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", provider: provider.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível testar a integração.");
      setNotice(result.message);
      await loadProviders();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Falha ao testar a integração.");
      await loadProviders();
    } finally {
      setBusyProvider(null);
    }
  }

  async function disconnect(provider: Provider) {
    setBusyProvider(provider.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível desconectar o gateway.");
      setNotice(result.message);
      await loadProviders();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Erro ao desconectar o gateway.");
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Pagamentos</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Integrações</h1>
        <p className="max-w-2xl text-sm text-slate-500">Configure os gateways usados pelos bots desta conta. As chaves são cifradas no servidor e nunca retornam para o navegador.</p>
      </header>

      {notice && <p role="status" className="rounded-lg border border-[#16452f] bg-[#0b1f14] px-4 py-3 text-sm text-[#61d49a]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-[#502626] bg-[#1d0b0b] px-4 py-3 text-sm text-[#ff9b9b]">{error}</p>}

      {loading && providers.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Carregando integrações">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
        </div>
      ) : error && providers.length === 0 ? (
        <button type="button" onClick={() => void loadProviders()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Tentar novamente</button>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => {
            const isEditing = editingProvider === provider.id;
            const busy = busyProvider === provider.id;
            const fields = credentialFields[provider.id] || [];
            return (
              <article key={provider.id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-600">
                      {provider.status === "coming-soon" ? <CreditCard aria-hidden="true" className="size-5" /> : <PlugZap aria-hidden="true" className="size-5" />}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-900">{provider.name}</h2>
                      <p className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(provider)}`}>
                        {provider.lastTestStatus === "success" ? <Check aria-hidden="true" className="size-3" /> : provider.status === "coming-soon" ? <CircleAlert aria-hidden="true" className="size-3" /> : null}
                        {statusText(provider)}
                      </p>
                    </div>
                  </div>
                  {provider.configuredCentrally && <ShieldCheck aria-label="Credenciais armazenadas com proteção" className="size-4 shrink-0 text-emerald-500" />}
                </div>
                <p className="mt-4 min-h-10 text-sm leading-relaxed text-slate-500">{provider.description}</p>
                {provider.legacyBotCount > 0 && (
                  <p className="mt-2 text-xs text-amber-600">{provider.legacyBotCount} bot(s) ainda usam credenciais antigas. Elas continuam funcionando como fallback.</p>
                )}

                {provider.environmentFallback && <p className="mt-2 text-xs text-amber-600">Há uma credencial global de ambiente ativa; o valor não é exibido.</p>}

                {provider.id === "mercadopago" && provider.marketplaceConnected && (
                  <p className="mt-2 text-xs text-emerald-700">Conta conectada por OAuth Marketplace. As cobranças continuam obedecendo ao gateway e ao webhook do tenant configurado.</p>
                )}

                {isEditing && fields.length > 0 ? (
                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                    {fields.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <label htmlFor={`${provider.id}-${field.key}`} className="text-xs font-medium text-slate-700">{field.label}</label>
                        <input
                          id={`${provider.id}-${field.key}`}
                          type="password"
                          autoComplete="new-password"
                          value={credentials[field.key] || ""}
                          onChange={(event) => setCredentials((current) => ({ ...current, [field.key]: event.target.value }))}
                          placeholder={provider.configuredCentrally ? "Configurado; deixe vazio para manter" : field.placeholder}
                          className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                        {field.description && <p className="text-xs text-slate-500">{field.description}</p>}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" onClick={() => void save(provider)} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50">
                        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />} Salvar
                      </button>
                      <button type="button" onClick={() => { setEditingProvider(null); setCredentials({}); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
                        <X aria-hidden="true" className="size-4" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                    {provider.status === "available" && (
                      <button type="button" onClick={() => beginEdit(provider)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-500">
                        <KeyRound aria-hidden="true" className="size-4" /> {provider.configuredCentrally ? "Editar" : "Configurar"}
                      </button>
                    )}
                    {provider.testable && provider.configuredCentrally && (
                      <button type="button" onClick={() => void test(provider)} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50">
                        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ExternalLink aria-hidden="true" className="size-4" />} Testar conexão
                      </button>
                    )}
                    {provider.id === "mercadopago" && provider.marketplaceReady && !provider.marketplaceConnected && (
                      <a href="/api/integrations/mercadopago/connect" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                        <ExternalLink aria-hidden="true" className="size-4" /> Conectar Marketplace OAuth
                      </a>
                    )}
                    {provider.id === "mercadopago" && !provider.marketplaceReady && (
                      <p className="basis-full text-xs text-slate-500">Split Marketplace indisponível até a plataforma configurar sua aplicação no painel administrativo.</p>
                    )}
                    {provider.configured && (
                      <button type="button" onClick={() => void disconnect(provider)} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-50">
                        <Trash2 aria-hidden="true" className="size-4" /> Desconectar
                      </button>
                    )}
                    {provider.status === "coming-soon" && <span className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm text-slate-500">Configuração indisponível</span>}
                    {provider.id === "amplopay" && <p className="basis-full text-xs text-slate-500">Sem teste automático: não foi identificado endpoint oficial seguro para validar sem criar uma cobrança.</p>}
                    {provider.id === "pix_direto" && <p className="basis-full text-xs text-slate-500">A chave não pode ser verificada automaticamente; a confirmação é manual.</p>}
                    {provider.lastTestAt && <p className="basis-full text-xs text-slate-500">Último teste: {new Date(provider.lastTestAt).toLocaleString("pt-BR")}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
