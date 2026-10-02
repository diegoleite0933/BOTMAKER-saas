"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SalesPoint = { label: string; paid: number; pending: number };
type BotSales = { botId: string; name: string; total: number };
type Period = "24h" | 7 | 15 | 30 | 365;

const periods: { value: Period; label: string }[] = [
  { value: "24h", label: "Últimas 24 horas" },
  { value: 7, label: "Últimos 7 dias" },
  { value: 15, label: "Últimos 15 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 365, label: "Últimos 365 dias" },
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function SalesChart() {
  const [period, setPeriod] = useState<Period>(7);
  const [result, setResult] = useState<{ period: Period; data: SalesPoint[]; ranking: BotSales[]; error: string } | null>(null);
  const loading = result?.period !== period;
  const data = loading ? [] : result.data;
  const error = loading ? "" : result.error;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/dashboard/sales?range=${period}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Não foi possível carregar as vendas.");
        setResult({ period, data: result.data, ranking: result.ranking || [], error: "" });
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setResult({ period, data: [], ranking: [], error: loadError.message || "Erro ao carregar o gráfico." });
        }
      });

    return () => controller.abort();
  }, [period]);

  return (
    <Card className="overflow-hidden rounded-lg border-blue-900 bg-blue-950 text-white">
      <CardHeader className="flex flex-col gap-3 px-4 pb-0 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:pt-6">
        <CardTitle className="text-lg font-bold text-blue-100 sm:text-xl">Histórico de Vendas</CardTitle>
        <label className="flex w-full items-center justify-between gap-2 text-sm text-white sm:w-auto sm:justify-start">
          <span>Período</span>
          <select
            aria-label="Filtrar vendas por período"
            className="h-10 min-w-0 w-full max-w-52 flex-1 rounded-md border border-blue-700 bg-blue-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:w-auto sm:flex-none"
            value={period}
            onChange={(event) => {
              const value = event.target.value;
              setPeriod(value === "24h" ? "24h" : Number(value) as Exclude<Period, "24h">);
            }}
          >
            {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
        {error ? (
          <div role="alert" className="flex h-[260px] items-center justify-center text-center text-sm text-rose-300 sm:h-[300px]">{error}</div>
        ) : loading ? (
          <div className="h-[260px] animate-pulse rounded bg-blue-900 sm:h-[300px]" aria-label="Carregando vendas" />
        ) : (
          <div className="h-[260px] w-full sm:h-[300px]" aria-label="Gráfico de vendas pagas e aguardando pagamento">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="#1e3a8a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#dbeafe", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis
                  tickFormatter={(value: number) => currency.format(value)}
                  tick={{ fill: "#dbeafe", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip
                  labelFormatter={(label) => label}
                  formatter={(value, name) => [currency.format(Number(value)), name]}
                  contentStyle={{ background: "#07152d", border: "1px solid #1d4ed8", borderRadius: 6, color: "#fff" }}
                  labelStyle={{ color: "#dbeafe" }}
                />
                <Legend verticalAlign="top" align="center" height={42} wrapperStyle={{ color: "#ffffff", fontSize: 11, width: "100%" }} />
                <Line type="monotone" dataKey="paid" name="Vendas Pagas" stroke="#7dd3fc" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="pending" name="Aguardando Pagamento" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!loading && !error && (
          <section className="mt-5 border-t border-blue-800 pt-4" aria-label="Ranking de vendas por bot no período">
            <h3 className="mb-3 text-sm font-semibold text-blue-100">Vendas por bot no período</h3>
            {result.ranking.length === 0 ? (
              <p className="text-sm text-blue-100/80">Nenhum bot cadastrado.</p>
            ) : (
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.ranking.map((bot, index) => (
                  <li key={bot.botId} className="flex min-w-0 items-center gap-3 rounded-md border border-blue-800 bg-blue-900/50 px-3 py-2.5 text-white">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{bot.name}</span>
                    <span className="shrink-0 text-sm font-semibold">{currency.format(bot.total)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
