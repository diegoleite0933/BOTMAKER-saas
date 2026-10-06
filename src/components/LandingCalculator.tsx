"use client";

import { useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function LandingCalculator() {
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [salesCount, setSalesCount] = useState("");
  const [hypotheticalRate, setHypotheticalRate] = useState("10");

  const revenue = Number(monthlyRevenue) || 0;
  const sales = Math.max(0, Math.floor(Number(salesCount) || 0));
  const rate = Math.min(100, Math.max(0, Number(hypotheticalRate) || 0));
  const projectedTake = revenue * rate / 100;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="grid content-start gap-4">
        <label className="space-y-2 text-sm font-medium text-[#d6d6d6]">
          Quanto você vende por mês?
          <span className="flex h-12 items-center rounded-lg border border-[#292929] bg-[#090909] px-3 focus-within:border-[#2f80ff]">
            <span className="mr-2 text-sm text-[#777]">R$</span>
            <input type="number" min="0" step="0.01" value={monthlyRevenue} onChange={(event) => setMonthlyRevenue(event.target.value)} placeholder="10.000,00" className="h-full min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-[#555]" />
          </span>
        </label>
        <label className="space-y-2 text-sm font-medium text-[#d6d6d6]">
          Quantidade de vendas no mês
          <input type="number" min="0" step="1" value={salesCount} onChange={(event) => setSalesCount(event.target.value)} placeholder="100" className="h-12 w-full rounded-lg border border-[#292929] bg-[#090909] px-3 text-white outline-none placeholder:text-[#555] focus:border-[#2f80ff]" />
        </label>
        <label className="space-y-2 text-sm font-medium text-[#d6d6d6]">
          Taxa percentual hipotética
          <span className="flex h-12 items-center rounded-lg border border-[#292929] bg-[#090909] px-3 focus-within:border-[#777]">
            <input type="number" min="0" max="100" step="0.1" value={hypotheticalRate} onChange={(event) => setHypotheticalRate(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-white outline-none" />
            <span className="ml-2 text-sm text-[#777]">%</span>
          </span>
        </label>
        <p className="text-xs leading-relaxed text-[#777]">A taxa percentual é hipotética e serve apenas para comparação. Não representa o preço de nenhum concorrente.</p>
      </div>

      <div aria-live="polite" className="grid content-start gap-3 rounded-xl border border-[#252525] bg-[#090909] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#1d1d1d] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#777]">ODISSEIA BOT</p>
            <p className="mt-1 text-sm text-[#aaa]">Estimativa de conversão · {sales} vendas</p>
          </div>
          <p className="text-xl font-semibold tabular-nums text-[#16c784]">{currency.format(projectedTake)}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-[#1d1d1d] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#777]">Cenário percentual</p>
            <p className="mt-1 text-sm text-[#aaa]">Simulação de {rate.toLocaleString("pt-BR")}% sobre {currency.format(revenue)}</p>
          </div>
          <p className="text-xl font-semibold tabular-nums text-white">{currency.format(revenue * rate / 100)}</p>
        </div>
        <p className="text-xs leading-relaxed text-[#858585]">A simulação é ilustrativa e serve para comparar cenários de faturamento. O foco do produto é a venda e a liberação de acesso, sem taxa fixa embutida.</p>
      </div>
    </div>
  );
}
