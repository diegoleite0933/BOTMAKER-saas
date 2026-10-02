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

type SalesPoint = { date: string; paid: number; pending: number };
type Period = 7 | 15 | 30 | 265;

const periods: { value: Period; label: string }[] = [
  { value: 7, label: "Últimos 7 dias" },
  { value: 15, label: "Últimos 15 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 265, label: "Últimos 265 dias" },
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function SalesChart() {
  const [period, setPeriod] = useState<Period>(7);
  const [result, setResult] = useState<{ period: Period; data: SalesPoint[]; error: string } | null>(null);
  const loading = result?.period !== period;
  const data = loading ? [] : result.data;
  const error = loading ? "" : result.error;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/dashboard/sales?days=${period}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Não foi possível carregar as vendas.");
        setResult({ period, data: result.data, error: "" });
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setResult({ period, data: [], error: loadError.message || "Erro ao carregar o gráfico." });
        }
      });

    return () => controller.abort();
  }, [period]);

  return (
    <Card className="overflow-hidden rounded-lg border-[#3a3d3c] bg-[#202221] text-white">
      <CardHeader className="flex flex-col gap-4 pb-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-xl font-bold text-lime-300">Histórico de Vendas</CardTitle>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>Período</span>
          <select
            aria-label="Filtrar vendas por período"
            className="h-9 rounded-md border border-[#4a4d4c] bg-[#292c2b] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value) as Period)}
          >
            {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </CardHeader>
      <CardContent className="pt-5">
        {error ? (
          <div role="alert" className="flex h-[300px] items-center justify-center text-sm text-rose-300">{error}</div>
        ) : loading ? (
          <div className="h-[300px] animate-pulse rounded bg-[#252827]" aria-label="Carregando vendas" />
        ) : (
          <div className="h-[300px] w-full" aria-label="Gráfico de vendas pagas e aguardando pagamento">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="#3a3d3c" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}
                  tick={{ fill: "#a3a3a3", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis
                  tickFormatter={(value: number) => currency.format(value)}
                  tick={{ fill: "#a3a3a3", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip
                  labelFormatter={(date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                  formatter={(value, name) => [currency.format(Number(value)), name]}
                  contentStyle={{ background: "#171918", border: "1px solid #3a3d3c", borderRadius: 6, color: "#fff" }}
                  labelStyle={{ color: "#d4d4d4" }}
                />
                <Legend verticalAlign="top" align="right" height={34} wrapperStyle={{ color: "#f5f5f5", fontSize: 12 }} />
                <Line type="monotone" dataKey="paid" name="Vendas Pagas" stroke="#c8f000" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="pending" name="Aguardando Pagamento" stroke="#00e5dc" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
