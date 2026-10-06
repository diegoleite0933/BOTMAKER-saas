"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Trophy } from "lucide-react";
import { Brand } from "@/components/Brand";

const milestones = [
  {
    value: "R$ 10K",
    title: "Primeira conquista",
    description: "Seu primeiro grande marco de faturamento começa aqui.",
    accent: "#7bd8ff",
  },
  {
    value: "R$ 50K",
    title: "Placa de reconhecimento",
    description: "Você provou que sua operação está crescendo e gerando resultados.",
    accent: "#6fe7ff",
  },
  {
    value: "R$ 100K",
    title: "Placa de reconhecimento",
    description: "Um novo nível de faturamento. Sua operação já alcançou uma marca de seis dígitos.",
    accent: "#7ef7d6",
    benefitLabel: "BENEFÍCIO EXCLUSIVO",
    benefitText: "Site gerenciador de bots exclusivo",
    isHighlight: true,
  },
  {
    value: "R$ 500K",
    title: "Placa de reconhecimento",
    description: "Meio milhão em faturamento. Sua operação alcançou um nível extraordinário.",
    accent: "#8db4ff",
  },
  {
    value: "R$ 1MM",
    title: "Placa de reconhecimento",
    description: "R$1 milhão em faturamento. O maior marco da jornada.",
    accent: "#d4d8ff",
    badge: "MARCO MÁXIMO",
  },
] as const;

const revenueMilestoneRules = [
  { milestone: 100000, benefit: "EXCLUSIVE_BOT_MANAGER_SITE", status: "LOCKED" },
  { milestone: 100000, benefit: "EXCLUSIVE_BOT_MANAGER_SITE", status: "ELIGIBLE" },
  { milestone: 100000, benefit: "EXCLUSIVE_BOT_MANAGER_SITE", status: "CLAIMED" },
] as const;

export function RevenueMilestonesCarousel() {
  const [activeIndex, setActiveIndex] = useState(2);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % milestones.length);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [isPaused]);

  const goTo = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + milestones.length) % milestones.length);
  };

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#79baff]">Seu crescimento merece ser reconhecido</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">Do primeiro faturamento ao seu primeiro milhão.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-[#9fb1c4] sm:text-base">
          Cada marco representa uma nova etapa da sua jornada com o Odisseia Bot.
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-[28px] border border-[#1c2d40] bg-[radial-gradient(circle_at_top,_rgba(17,62,84,0.5),transparent_48%),rgba(3,8,12,0.95)] px-2 py-8 sm:px-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="relative mx-auto flex min-h-[540px] max-w-5xl items-center justify-center gap-3 sm:gap-6">
          {milestones.map((milestone, index) => {
            const rawDistance = (index - activeIndex + milestones.length) % milestones.length;
            const relativeDistance = rawDistance > milestones.length / 2 ? rawDistance - milestones.length : rawDistance;
            const isCenter = relativeDistance === 0;
            const isSide = Math.abs(relativeDistance) === 1;
            const isHidden = Math.abs(relativeDistance) > 1;

            if (isHidden) return null;

            return (
              <article
                key={`${milestone.value}-${index}`}
                className={[
                  "group relative flex w-[280px] shrink-0 rounded-[28px] border border-[#1e2f3d] bg-[#071117] p-4 text-left shadow-[0_20px_64px_rgba(0,0,0,0.42)] transition-all duration-500 ease-out",
                  isCenter ? "z-20 h-[430px] w-[330px] scale-100 opacity-100" : "z-10 h-[340px] scale-[0.82] opacity-50 blur-[0.5px]",
                  isSide ? "pointer-events-auto" : "pointer-events-none",
                ].join(" ")}
                style={{
                  transform: isCenter ? "translateX(0) scale(1)" : isSide ? "translateX(0) scale(0.82)" : "translateX(0) scale(0.75)",
                  boxShadow: isCenter ? "0 24px 80px rgba(11,162,255,0.16), inset 0 0 0 1px rgba(104,172,255,0.22)" : "0 18px 42px rgba(0,0,0,0.44)",
                  filter: isCenter ? "none" : "blur(0.2px)",
                  opacity: isCenter ? 1 : 0.58,
                }}
              >
                <div
                  className="absolute inset-0 rounded-[28px] border border-white/5 bg-[radial-gradient(circle_at_top,_rgba(67,180,255,0.2),transparent_30%),linear-gradient(135deg,#071117_0%,#030a11_100%)]"
                  style={{ boxShadow: `inset 0 0 30px ${milestone.accent}33` }}
                />

                <div className="relative z-10 flex h-full w-full flex-col">
                  <div className="flex items-center justify-between">
                    <div className="rounded-full border border-[#1b3040] bg-[#091922] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8cc9ff]">
                      {milestone.badge || "PLACA"}
                    </div>
                    <div className="rounded-full border border-[#1b3040] bg-[#091922] px-1.5 py-1 text-[8px] font-medium uppercase tracking-[0.18em] text-[#b1d7ff]">
                      {milestone.value}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-center">
                    <div className="relative flex h-[110px] w-[110px] items-center justify-center rounded-[28px] border border-[#9be3ff]/30 bg-[radial-gradient(circle_at_50%_30%,rgba(90,215,255,0.32),rgba(13,22,29,0.95)_60%)] shadow-[inset_0_0_30px_rgba(0,255,255,0.08),0_0_24px_rgba(62,132,255,0.18)]">
                      <div className="absolute inset-[8px] rounded-[22px] border border-white/10 bg-black/10" />
                      <Brand className="scale-75 text-[0.8rem] text-[#dff7ff]" />
                    </div>
                  </div>

                  <div className="mt-6 text-center">
                    <div className="text-[2rem] font-black tracking-[-0.09em] text-white sm:text-[2.5rem]">{milestone.value}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-[#7bc0ff]">{milestone.title}</div>
                  </div>

                  <div className="mt-4 flex-1 text-center text-sm leading-relaxed text-[#d8e4f4]">
                    {milestone.description}
                  </div>

                  {milestone.isHighlight && (
                    <div className="mt-4 rounded-2xl border border-[#7ae7d1]/40 bg-[linear-gradient(135deg,rgba(16,26,30,0.9),rgba(9,19,18,0.9))] p-3 text-center shadow-[0_0_25px_rgba(76,255,208,0.12)]">
                      <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7ef7d6]">
                        <Sparkles aria-hidden="true" className="size-3.5" />
                        BENEFÍCIO EXCLUSIVO
                      </div>
                      <div className="mt-2 text-sm font-medium text-white">Site gerenciador de bots exclusivo</div>
                    </div>
                  )}

                  {milestone.badge === "MARCO MÁXIMO" && (
                    <div className="mt-4 flex items-center justify-center gap-2 rounded-full border border-[#e2d6ff]/35 bg-[#1b1830] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d8d4ff]">
                      <Trophy aria-hidden="true" className="size-3.5" />
                      MARCO MÁXIMO
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden w-24 bg-gradient-to-r from-[#05070b] via-[#05070b]/80 to-transparent sm:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden w-24 bg-gradient-to-l from-[#05070b] via-[#05070b]/80 to-transparent sm:block" />

        <button
          aria-label="Ver placa anterior"
          type="button"
          onClick={() => goTo(-1)}
          className="absolute left-4 top-1/2 z-40 flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#65d9ff]/40 bg-[#08131a]/80 text-[#bce7ff] shadow-[0_0_30px_rgba(80,170,255,0.22)] transition-all duration-200 hover:scale-105 hover:border-[#7cc6ff] hover:text-white sm:left-8"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>

        <button
          aria-label="Ver próxima placa"
          type="button"
          onClick={() => goTo(1)}
          className="absolute right-4 top-1/2 z-40 flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#65d9ff]/40 bg-[#08131a]/80 text-[#bce7ff] shadow-[0_0_30px_rgba(80,170,255,0.22)] transition-all duration-200 hover:scale-105 hover:border-[#7cc6ff] hover:text-white sm:right-8"
        >
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2.5">
        {milestones.map((milestone, index) => (
          <button
            key={`${milestone.value}-dot-${index}`}
            type="button"
            aria-label={`Selecionar ${milestone.value}`}
            onClick={() => setActiveIndex(index)}
            className={[
              "h-2.5 w-2.5 rounded-full transition-all duration-300",
              index === activeIndex ? "w-7 bg-[#7ec7ff] shadow-[0_0_18px_rgba(126,199,255,0.7)]" : "bg-[#2a3f53] hover:bg-[#4a6885]",
            ].join(" ")}
          />
        ))}
      </div>

      <div className="mt-8 rounded-[26px] border border-[#1d3347] bg-[#0a1117] px-4 py-4 text-center text-sm text-[#dfeaf7] sm:text-base">
        <span className="font-medium text-white">Atinja R$100K em faturamento</span> e ganhe um <span className="font-semibold text-[#73d2ff]">site gerenciador de bots exclusivo</span> para sua operação.
      </div>

      <div className="mt-3 text-center text-xs uppercase tracking-[0.2em] text-[#7da9d0]">{revenueMilestoneRules[0].benefit}</div>
    </section>
  );
}
