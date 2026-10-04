"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  CircleHelp,
  DollarSign,
  RefreshCw,
  ShoppingBag,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Period = "today" | "yesterday" | "7d" | "30d" | "all";
type DashboardData = {
  period: Period;
  metrics: {
    revenue: number;
    revenueGoal: number | null;
    approvedSales: number;
    totalPix: number;
    conversionRate: number;
    starts: number;
    averageTicket: number;
    pendingOrders: number;
    activeBots: number;
    activeAccesses: number;
    activeProducts: number;
  };
  data: { label: string; revenue: number }[];
  ranking: { botId: string; name: string; total: number }[];
};

const periods: { value: Period; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "all", label: "Total" },
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function formatCurrency(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function MetricCard({
  icon: Icon,
  title,
  value,
  detail,
  accent = "text-white",
  children,
}: {
  icon: typeof DollarSign;
  title: string;
  value: string;
  detail: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="group flex min-h-40 flex-col rounded-xl border border-[#1c1c1c] bg-[#090909] p-5 transition-colors hover:border-[#303030]">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#202735] bg-[#101722] text-[#2f80ff]">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <h2 className="text-sm font-medium text-[#c6c6c6]">{title}</h2>
      </div>
      <p className={`mt-5 text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-[#777]">{detail}</p>
      {children}
    </article>
  );
}

function MetricSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="min-h-40 animate-pulse rounded-xl border border-[#1c1c1c] bg-[#090909] p-5" aria-label="Carregando métrica">
          <div className="h-9 w-32 rounded bg-[#161616]" />
          <div className="mt-6 h-7 w-28 rounded bg-[#161616]" />
          <div className="mt-3 h-3 w-36 rounded bg-[#121212]" />
        </div>
      ))}
    </div>
  );
}

export function DashboardOverview({ userName }: { userName: string }) {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [requestStatus, setRequestStatus] = useState<{ period: Period; key: number; error?: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [localHour, setLocalHour] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
      setLocalHour(Number(parts.find((part) => part.type === "hour")?.value || 12));
      setTodayLabel(new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(now).toLocaleUpperCase("pt-BR"));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/dashboard/metrics?period=${period}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Não foi possível carregar os dados.");
        setData(result);
        setGoalInput(result.metrics.revenueGoal ? String(result.metrics.revenueGoal) : "");
        setRequestStatus({ period, key: refreshKey });
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setRequestStatus({ period, key: refreshKey, error: "Não foi possível carregar os dados." });
      });

    return () => controller.abort();
  }, [period, refreshKey]);

  const currentRequest = requestStatus?.period === period && requestStatus.key === refreshKey;
  const loading = !currentRequest;
  const error = currentRequest ? requestStatus.error || "" : "";

  async function saveGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingGoal(true);
    setGoalError("");
    try {
      const response = await fetch("/api/dashboard/metrics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueGoal: Number(goalInput) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar a meta.");
      setEditingGoal(false);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setGoalError(saveError instanceof Error ? saveError.message : "Erro ao salvar a meta.");
    } finally {
      setSavingGoal(false);
    }
  }

  const metrics = data?.metrics;
  const goalAttainment = metrics?.revenueGoal ? (metrics.revenue / metrics.revenueGoal) * 100 : 0;
  const goalProgress = Math.min(100, goalAttainment);

  return (
    <section className="dashboard-overview space-y-5 text-[#f5f5f5] sm:space-y-7">
      <header className="grid gap-4 rounded-xl border border-[#1c1c1c] bg-[#080808] p-4 sm:p-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="min-w-0 rounded-lg border border-[#202020] bg-[#0d0d0d] px-4 py-3 lg:max-w-64">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#858585]">Faturamento</span>
            {metrics?.revenueGoal ? <span className="text-xs font-semibold text-[#16c784]">{goalAttainment.toFixed(0)}%</span> : null}
          </div>
          <p className="mt-1 text-xl font-semibold tabular-nums text-white">{formatCurrency(metrics?.revenue || 0)}</p>
          {metrics?.revenueGoal ? (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1b1b1b]" role="progressbar" aria-label="Meta de faturamento atingida" aria-valuenow={Math.round(goalProgress)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-[#16c784] transition-[width]" style={{ width: `${goalProgress}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[11px] text-[#777]">Meta: {formatCurrency(metrics.revenueGoal)}</p>
                <button type="button" onClick={() => setEditingGoal(true)} className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#858585] hover:text-white"><Target aria-hidden="true" className="size-3" /> Editar</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setEditingGoal(true)} className="mt-1 text-left text-xs text-[#8a8a8a] transition-colors hover:text-white">Definir meta de faturamento</button>
          )}
        </div>

        <div className="text-left lg:text-center">
          <p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {localHour === null ? "Olá" : greeting(localHour)}, <span className="text-[#2f80ff]">{userName.toLocaleUpperCase("pt-BR")}</span>
          </p>
          <p className="mt-1 text-[10px] font-medium tracking-[0.14em] text-[#777]">{todayLabel || " "}</p>
        </div>

        <div className="flex items-center gap-2 lg:justify-self-end">
          <button type="button" onClick={() => setHelpOpen((current) => !current)} aria-label="Ajuda" title="Ajuda" className="relative flex size-10 items-center justify-center rounded-lg border border-[#232323] bg-[#0d0d0d] text-[#aaa] transition-colors hover:border-[#3a3a3a] hover:text-white">
            {helpOpen ? <X aria-hidden="true" className="size-4" /> : <CircleHelp aria-hidden="true" className="size-4" />}
          </button>
          <Link href="/dashboard/bots" aria-label="Bots e equipe" title="Bots e equipe" className="flex size-10 items-center justify-center rounded-lg border border-[#232323] bg-[#0d0d0d] text-[#aaa] transition-colors hover:border-[#3a3a3a] hover:text-white">
            <UsersRound aria-hidden="true" className="size-4" />
          </Link>
          <Link href="/dashboard/sales" aria-label={metrics?.pendingOrders ? `${metrics.pendingOrders} pedidos aguardando` : "Pedidos"} title="Pedidos" className="relative flex size-10 items-center justify-center rounded-lg border border-[#232323] bg-[#0d0d0d] text-[#aaa] transition-colors hover:border-[#3a3a3a] hover:text-white">
            <Bell aria-hidden="true" className="size-4" />
            {!!metrics?.pendingOrders && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#16c784]" aria-label="Há pedidos pendentes" />}
          </Link>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)} disabled={loading} aria-label="Atualizar métricas" title="Atualizar métricas" className="flex size-10 items-center justify-center rounded-lg border border-[#232323] bg-[#0d0d0d] text-[#aaa] transition-colors hover:border-[#3a3a3a] hover:text-white disabled:cursor-wait disabled:opacity-50">
            <RefreshCw aria-hidden="true" className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link href="/dashboard/bots/new" aria-label="Criar bot" title="Criar bot" className="flex size-10 items-center justify-center rounded-lg bg-[#2f80ff] text-white transition-colors hover:bg-[#1677ff]">
            <Bot aria-hidden="true" className="size-[18px]" />
          </Link>
        </div>
        {helpOpen && (
          <div role="dialog" aria-label="Ajuda do dashboard" className="flex items-center justify-between gap-3 rounded-lg border border-[#252525] bg-[#101010] px-4 py-3 text-sm text-[#bbb] lg:col-span-3">
            <span>Gerencie conexões, ofertas e pagamentos Pix na área dos seus bots.</span>
            <Link href="/dashboard/bots" onClick={() => setHelpOpen(false)} className="inline-flex shrink-0 items-center gap-1 text-[#7eb0ff] hover:text-white">Abrir bots <ArrowUpRight aria-hidden="true" className="size-3.5" /></Link>
          </div>
        )}
      </header>

      {editingGoal && (
        <form onSubmit={saveGoal} className="flex flex-col gap-3 rounded-xl border border-[#252525] bg-[#0d0d0d] p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="revenue-goal" className="text-sm font-medium text-[#ddd]">Meta de faturamento (R$)</label>
            <input id="revenue-goal" type="number" min="0" max="1000000000" step="0.01" value={goalInput} onChange={(event) => setGoalInput(event.target.value)} required className="mt-2 h-10 w-full rounded-lg border border-[#292929] bg-[#080808] px-3 text-sm text-white outline-none focus:border-[#2f80ff] sm:max-w-xs" />
            {goalError && <p role="alert" className="mt-2 text-xs text-rose-400">{goalError}</p>}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={savingGoal} className="h-10 rounded-lg bg-[#2f80ff] px-4 text-sm font-medium text-white hover:bg-[#1677ff] disabled:opacity-50">{savingGoal ? "Salvando..." : "Salvar meta"}</button>
            <button type="button" onClick={() => { setEditingGoal(false); setGoalError(""); }} className="h-10 rounded-lg border border-[#292929] px-4 text-sm text-[#bbb] hover:bg-[#171717]">Cancelar</button>
          </div>
        </form>
      )}

      <nav aria-label="Período das métricas" className="flex items-center gap-2 overflow-x-auto rounded-xl border border-[#1c1c1c] bg-[#090909] p-2">
        <span className="mr-2 shrink-0 px-2 text-xs font-semibold uppercase tracking-wider text-[#777]">Período</span>
        {periods.map((option) => (
          <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => setPeriod(option.value)} className={`h-9 shrink-0 rounded-lg px-4 text-sm transition-colors ${period === option.value ? "bg-[#171717] text-white ring-1 ring-[#303030]" : "text-[#888] hover:bg-[#111] hover:text-white"}`}>
            {option.label}
          </button>
        ))}
      </nav>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-[#362323] bg-[#100b0b] px-5 py-12 text-center">
          <p className="text-sm text-[#ddd]">Não foi possível carregar os dados.</p>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="rounded-lg border border-[#3a3030] px-4 py-2 text-sm text-white transition-colors hover:bg-[#211616]">Tentar novamente</button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-2">
            {loading || !metrics ? <MetricSkeleton /> : (
              <>
                <MetricCard icon={DollarSign} title="Vendas aprovadas" value={formatCurrency(metrics.revenue)} detail={`${metrics.approvedSales} ${metrics.approvedSales === 1 ? "venda paga" : "vendas pagas"}`} accent="text-[#16c784]">
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#1b1b1b]">
                    <div className="h-full bg-[#16c784] transition-[width]" style={{ width: `${metrics.totalPix ? Math.min(100, (metrics.approvedSales / metrics.totalPix) * 100) : 0}%` }} />
                  </div>
                </MetricCard>
                <MetricCard icon={Activity} title="Taxa de conversão" value={`${metrics.conversionRate.toFixed(2)}%`} detail={`${metrics.approvedSales} pagos de ${metrics.starts} leads`}>
                  <p className="mt-2 text-[11px] text-[#666]">{metrics.totalPix} PIX gerados no período</p>
                </MetricCard>
                <MetricCard icon={UsersRound} title="Total starts" value={metrics.starts.toLocaleString("pt-BR")} detail="leads iniciaram conversa" />
                <MetricCard icon={ShoppingBag} title="Ticket médio" value={formatCurrency(metrics.averageTicket)} detail={`Vendas: ${formatCurrency(metrics.revenue)}`}>
                  <div className="mt-auto flex items-center justify-between border-t border-[#1c1c1c] pt-3 text-xs">
                    <span className="text-[#777]">PIX pagos</span>
                    <span className="font-medium tabular-nums text-[#d8d8d8]">{metrics.approvedSales}</span>
                  </div>
                </MetricCard>
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div className="rounded-lg border border-[#1c1c1c] bg-[#090909] p-3"><p className="text-[11px] text-[#777]">Bots ativos</p><p className="mt-1 text-lg font-semibold text-white">{metrics.activeBots}</p></div>
                  <div className="rounded-lg border border-[#1c1c1c] bg-[#090909] p-3"><p className="text-[11px] text-[#777]">Acessos ativos</p><p className="mt-1 text-lg font-semibold text-white">{metrics.activeAccesses}</p></div>
                  <div className="rounded-lg border border-[#1c1c1c] bg-[#090909] p-3"><p className="text-[11px] text-[#777]">Ofertas ativas</p><p className="mt-1 text-lg font-semibold text-white">{metrics.activeProducts}</p></div>
                </div>
              </>
            )}
          </div>

          <article className="flex min-h-[390px] min-w-0 flex-col rounded-xl border border-[#1c1c1c] bg-[#090909] p-4 sm:p-5 lg:row-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Seu desempenho</h2>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#777]">{periods.find((option) => option.value === period)?.label}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-xs text-[#8a8a8a]"><span className="size-2 rounded-full bg-[#2f80ff]" /> Receita</span>
            </div>
            {loading || !data ? (
              <div className="mt-5 min-h-64 flex-1 animate-pulse rounded-lg bg-[#111]" aria-label="Carregando gráfico" />
            ) : (
              <div className="mt-5 min-h-64 flex-1" aria-label="Gráfico de receita">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.data} margin={{ top: 8, right: 4, left: 2, bottom: 2 }}>
                    <CartesianGrid stroke="#191919" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis tickFormatter={(value: number) => compactCurrency.format(value)} tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={false} width={68} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Receita"]} contentStyle={{ background: "#111", border: "1px solid #292929", borderRadius: 8, color: "#fff" }} labelStyle={{ color: "#aaa" }} />
                    <Line type="monotone" dataKey="revenue" name="Receita" stroke="#2f80ff" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#2f80ff", stroke: "#050505", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {!loading && !error && metrics?.approvedSales === 0 && <p className="mt-3 text-center text-xs text-[#777]">Você ainda não possui vendas neste período.</p>}
            {!loading && !!data?.ranking.length && (
              <div className="mt-4 border-t border-[#1c1c1c] pt-3">
                <p className="mb-2 text-xs font-medium text-[#8a8a8a]">Receita por bot</p>
                <div className="space-y-2">
                  {data.ranking.slice(0, 3).map((bot) => <div key={bot.botId} className="flex min-w-0 items-center justify-between gap-2 text-xs"><span className="truncate text-[#999]">{bot.name}</span><span className="shrink-0 tabular-nums text-[#ddd]">{formatCurrency(bot.total)}</span></div>)}
                </div>
              </div>
            )}
          </article>
        </div>
      )}

    </section>
  );
}