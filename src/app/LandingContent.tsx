import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  CreditCard,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { LandingNavigation } from "@/components/LandingNavigation";
import { LandingPhoneMockup } from "@/components/LandingPhoneMockup";
import { RevenueMilestonesCarousel } from "@/components/RevenueMilestonesCarousel";

const capabilities = [
  { icon: Bot, title: "Bots e entregas", description: "Controle clientes, acessos e entregas em um só lugar." },
  { icon: WalletCards, title: "Pagamentos PIX", description: "Gere cobranças e acompanhe a confirmação pelo backend." },
  { icon: MessageSquareText, title: "Remarketing", description: "Reative leads em momentos certos com ofertas inteligentes." },
  { icon: ShieldCheck, title: "Segurança", description: "Credenciais protegidas e isolamento por tenant." },
];

const integrationList = [
  { name: "Mercado Pago", mark: "MP", status: "Disponível", available: true },
  { name: "AmploPay", mark: "A", status: "Disponível", available: true },
  { name: "PIX Direto", mark: "PIX", status: "Disponível · isento", available: true },
  { name: "SyncPay", mark: "S", status: "Disponível", available: true },
  { name: "Pushin Pay", mark: "P", status: "Em breve", available: false },
  { name: "Átomo Pay", mark: "Á", status: "Em breve", available: false },
  { name: "Nexus Wallet", mark: "N", status: "Em breve", available: false },
  { name: "Stripe", mark: "S", status: "Em breve", available: false },
  { name: "Oasy Pay", mark: "O", status: "Em breve", available: false },
];

const processFlow = [
  ["01", "Crie sua conta", "Cadastre sua conta e configure o seu perfil de operação."],
  ["02", "Configure o bot", "Conecte um bot do Telegram e personalize o canal de acesso."],
  ["03", "Conecte o gateway", "Use Mercado Pago, AmploPay, PIX Direto ou SyncPay."],
  ["04", "Crie o produto", "Defina preço, acesso e regras de entrega."],
  ["05", "Venda pelo Telegram", "O bot gera a cobrança e libera o acesso automaticamente."],
];

const stats = [
  { value: "24/7", label: "venda automática" },
  { value: "PIX", label: "pagamentos em tempo real" },
  { value: "< 1 min", label: "liberação do acesso" },
];

const faq = [
  { question: "O que é o Odisseia Bot?", answer: "É uma solução SaaS para vender produtos e acessos pelo Telegram com pagamentos, automações e controle de clientes em um painel centralizado." },
  { question: "Preciso programar para usar?", answer: "Não. O cliente conecta sua conta do gateway, cria o bot e configura o produto na própria interface do painel." },
  { question: "Como o pagamento é confirmado?", answer: "O sistema valida a transação no backend, confirma o status e libera o acesso apenas depois da validação real do gateway." },
  { question: "Posso vender recorrência?", answer: "A cobrança recorrente automática ainda não está disponível. Os produtos atuais geram cobranças PIX avulsas." },
  { question: "A plataforma é multi-tenant?", answer: "Sim. Cada cliente mantém seu próprio fluxo de configuração e credenciais, com isolamento entre contas e transações." },
];

export function LandingContent() {
  return (
    <div className="min-h-screen bg-[#05070b] text-white selection:bg-[#2f80ff]/30">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#05070b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Brand className="text-white" />
          </Link>
          <LandingNavigation />
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(circle_at_20%_0%,rgba(47,128,255,0.22),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(41,129,255,0.12),transparent_24%)]" />

        <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-16 lg:min-h-[700px] lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 xl:gap-10">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1a2a3d] bg-[#09121c] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#a8c8ff]">
              <Sparkles aria-hidden="true" className="size-3.5 text-[#4aa3ff]" />
              Automação de vendas para Telegram
            </div>

            <h1 className="mt-6 text-[2.45rem] font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[4rem] lg:text-[4.5rem]">
              AUTOMAÇÃO DE
              <span className="mt-2 block text-[#5aa9ff]">VENDAS PARA TELEGRAM.</span>
            </h1>

            <p className="mt-6 max-w-[560px] text-base leading-relaxed text-[#8ea3b8] sm:text-lg">
              Crie bots, receba pagamentos PIX, libere acessos e gerencie clientes em uma plataforma SaaS profissional e segura.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="h-12 w-full gap-2 rounded-xl bg-[#0c7bff] px-6 text-white shadow-[0_20px_40px_rgba(12,123,255,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1f8dff] sm:w-auto">
                  CRIAR MINHA CONTA
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              </Link>
              <Link href="#como-funciona">
                <Button variant="outline" size="lg" className="h-12 w-full rounded-xl border border-[#263548] bg-[#0a1118] px-6 text-white transition-all duration-300 hover:border-[#3d6ca9] hover:bg-[#0d1722] sm:w-auto">
                  VER COMO FUNCIONA
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.12em] text-[#9bb3d1]">
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-3.5 text-[#5aa9ff]" /> bots Telegram</span>
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-3.5 text-[#5aa9ff]" /> pagamentos PIX</span>
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-3.5 text-[#5aa9ff]" /> pagamentos confirmados</span>
            </div>
          </div>

          <div className="relative z-10 flex justify-center lg:justify-end">
            <div className="premium-float relative w-full max-w-[560px]">
              <LandingPhoneMockup />
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-2 sm:px-6">
          <div className="rounded-[32px] border border-[#1c384d] bg-[linear-gradient(135deg,rgba(10,22,32,0.95),rgba(7,12,18,0.96))] p-5 shadow-[0_24px_80px_rgba(15,109,255,0.12)] sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#79baff]">Promoção ativa</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.06em] text-white sm:text-3xl">Pagamentos e acesso em fluxo automático.</h2>
              </div>

              <div className="rounded-2xl border border-[#204767] bg-[#0a1723] px-4 py-3 text-center">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#8ec2ff]">PIX direto</div>
                <div className="mt-1 text-lg font-bold text-[#aef2d0]">Disponível</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { title: "Sem taxa fixa embutida", text: "Você mantém o controle do seu preço de venda e da operação do bot." },
                { title: "Preço transparente", text: "A cobrança continua sendo feita pelo gateway escolhido pelo cliente." },
                { title: "Foco em automação", text: "O valor real vem da venda e da entrega em tempo real do acesso." },
              ].map(({ title, text }) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-[#0d141b] p-4">
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-[#8ea3b8]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <RevenueMilestonesCarousel />

        <section id="comparativo" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5aa9ff]">Comparativo</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">O Odisseia Bot fica melhor em custo, clareza e controle.</h2>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {[
              {
                name: "Outros sites",
                fee: "Taxa variável",
                extra: "depende do plano e do volume",
                details: ["Cobrança extra por volume", "Estrutura menos transparente", "Menos controle do cliente", "Margem mais apertada para escalar"],
                highlight: false,
              },
              {
                name: "Marketplaces tradicionais",
                fee: "Comissão por transação",
                extra: "+ dependência da plataforma",
                details: ["Cobrança por operação", "Menos autonomia na venda", "Falta de controle do cliente", "Fluxo mais rígido para escalar"],
                highlight: false,
              },
              {
                name: "Odisseia Bot",
                fee: "Sem taxa fixa",
                extra: "você define seu preço e gateway",
                details: ["Custo previsível", "Pagamento só quando a venda ocorre", "Controle total do fluxo", "Mais margem para escalar"],
                highlight: true,
              },
            ].map(({ name, fee, extra, details, highlight }) => (
              <div
                key={name}
                className={[
                  "rounded-[30px] border p-6",
                  highlight
                    ? "border-[#2a7ef7] bg-[linear-gradient(180deg,#0d1e2e,#08141c)] shadow-[0_20px_50px_rgba(35,138,255,0.15)]"
                    : "border-white/10 bg-[#0a1117]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-white">{name}</div>
                  {highlight && (
                    <span className="rounded-full border border-[#7ec7ff]/40 bg-[#0d2643] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7ec7ff]">
                      Melhor custo
                    </span>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-white/8 bg-[#0f171f] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#8ec2ff]">Taxa</div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.06em] text-white">{fee}</div>
                  <div className="mt-1 text-sm text-[#9fb1c4]">{extra}</div>
                </div>

                <ul className="mt-5 space-y-3">
                  {details.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-[#cddae7]">
                      <span className="mt-1 flex size-5 items-center justify-center rounded-full bg-[#163f66] text-[10px] font-bold text-[#7ec7ff]">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#070b12]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mb-10 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5aa9ff]">Capacidades</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                Seu canal de vendas operando com menos fricção e mais precisão.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <article className="rounded-[30px] border border-[#1c2d40] bg-[linear-gradient(135deg,#0d1620_0%,#071018_100%)] p-6 sm:p-8 lg:row-span-2">
                <div className="inline-flex rounded-full border border-[#1c2d40] bg-[#0a1520] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#8ab9ff]">Fluxo principal</div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-white">Entrada automática, aprovação e liberação de acesso.</h3>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#93a7b8]">
                  O cliente compra, o sistema valida o pagamento, identifica o tenant, confirma a transação e libera o acesso sem necessidade de intervenção manual.
                </p>
                <div className="mt-8 space-y-4">
                  {[
                    ["Pagamento confirmado", "Webhook validado e transação aprovada."],
                    ["Acesso liberado", "Grupo, canal, link ou produto entregue ao cliente."],
                    ["Acompanhamento", "Histórico de pedidos e status de pagamento."],
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-2xl border border-white/8 bg-[#0b131b] p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[#0d4d99] text-xs font-semibold text-white">✓</span>
                        <span className="text-sm font-medium text-white">{title}</span>
                      </div>
                      <p className="mt-2 text-sm text-[#8ea3b8]">{text}</p>
                    </div>
                  ))}
                </div>
              </article>

              {capabilities.slice(0, 2).map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-[28px] border border-white/10 bg-[#0a1117] p-6">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-[#1d3551] bg-[#0d1a2b] text-[#67afff]">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#8ea3b8]">{description}</p>
                </article>
              ))}

              {capabilities.slice(2).map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-[28px] border border-white/10 bg-[#0a1117] p-6 lg:col-span-1">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-[#1d3551] bg-[#0d1a2b] text-[#67afff]">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#8ea3b8]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5aa9ff]">Do zero à primeira venda</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">Operação simples, previsível e pronta para escalar.</h2>
            </div>
            <div className="text-sm text-[#8ea3b8]">5 etapas para transformar seu Telegram em uma máquina de vendas.</div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-5">
            {processFlow.map(([number, title, description]) => (
              <div key={number} className="rounded-[28px] border border-white/10 bg-[#0b1017] p-5">
                <div className="text-5xl font-semibold tracking-[-0.08em] text-[#5aa9ff]">{number}</div>
                <h3 className="mt-6 text-lg font-medium text-white">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#8ea3b8]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="integracoes" className="scroll-mt-20 border-y border-white/10 bg-[#070b12]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5aa9ff]">Integrações</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">Tudo conectado ao seu negócio.</h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-[#8ea3b8]">
                  Conecte seus gateways de pagamento e ferramentas essenciais para operar vendas, cobrança e acesso de forma automatizada.
                </p>
                <div className="mt-8 space-y-4">
                  {[
                    "Autenticação real pela API SyncPay",
                    "PIX gerado pelo backend",
                    "Webhooks validados e idempotentes",
                    "Pagamentos e webhooks por conta conectada",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#0a1118] px-4 py-3 text-sm text-[#dce7f7]">
                      <span className="flex size-6 items-center justify-center rounded-full bg-[#143d6d] text-[#7bb5ff]">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative rounded-[32px] border border-[#1a2a3d] bg-[radial-gradient(circle_at_center,_rgba(47,128,255,0.18),rgba(7,11,17,0.96)_48%)] p-6 shadow-[0_24px_80px_rgba(8,45,90,0.2)]">
                <div className="grid gap-3 sm:grid-cols-2">
                  {integrationList.map(({ name, mark, status, available }) => (
                    <div
                      key={name}
                      className={`flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 ${
                        available
                          ? "border-[#1d3d5e] bg-[#0d1d2d] text-white"
                          : "border-white/10 bg-[#0b1118] text-[#8ea3b8]"
                      }`}
                    >
                      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-[10px] font-bold text-white">{mark}</span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{name}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${
                        available
                          ? "border-[#1a4e3b] bg-[#0d1f19] text-[#7be4af]"
                          : "border-white/10 bg-[#111821] text-[#9caabd]"
                      }`}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {stats.map(({ value, label }) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#0a1118] p-4 text-center">
                      <div className="text-2xl font-semibold tracking-[-0.06em] text-white">{value}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#8ea3b8]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="rounded-[30px] border border-[#1e3044] bg-[#0a1117] p-6 sm:p-8">
              <div className="flex items-center gap-3 text-[#7bb5ff]">
                <ShieldCheck aria-hidden="true" className="size-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Segurança</span>
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-white">Pagamentos seguros. Dados protegidos. Infraestrutura pronta para crescer.</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#8ea3b8]">
                O fluxo foi desenhado para proteger credenciais, validar webhooks e evitar processamentos duplicados. Cada conta e tenant recebe o seu próprio contexto de pagamento.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: LockKeyhole, title: "Credenciais protegidas", description: "Segredo do cliente nunca exposto no frontend." },
                { icon: TrendingUp, title: "Escala do SaaS", description: "Estrutura preparada para múltiplos clientes e contas sincronizadas." },
                { icon: Zap, title: "Automação confiável", description: "Validação e processamento no backend para evitar fraudes e duplicidades." },
                { icon: CreditCard, title: "Cobrança real", description: "PIX e confirmação de pagamento pelo backend." },
              ].map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-[26px] border border-white/10 bg-[#0b1117] p-5">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#1d3551] bg-[#0d1a2b] text-[#67afff]">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#8ea3b8]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-white/10 bg-[#070b12]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5aa9ff]">FAQ</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">Perguntas que importam na hora de vender.</h2>
            </div>

            <div className="mt-10 space-y-4">
              {faq.map(({ question, answer }) => (
                <div key={question} className="rounded-[22px] border border-white/8 bg-[#0a1117] p-5">
                  <h3 className="text-lg font-medium text-white">{question}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#8ea3b8]">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
          <div className="rounded-[32px] border border-[#1d324f] bg-[linear-gradient(135deg,rgba(9,17,25,0.98),rgba(7,9,14,0.96))] p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7bb5ff]">Pronto para automatizar suas vendas?</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">Crie seu Odisseia Bot, conecte seu gateway e comece a vender pelo Telegram.</h2>
              </div>

              <Link href="/register">
                <Button size="lg" className="h-12 rounded-xl bg-[#0c7bff] px-6 text-white shadow-[0_20px_40px_rgba(12,123,255,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1f8dff]">
                  CRIAR MINHA CONTA
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#070b12]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 text-sm text-[#8ea3b8] sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Brand className="text-white" />
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#8ea3b8]">ODISSEIA BOT — automação, pagos e acesso por Telegram.</p>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Link href="#recursos" className="transition-colors hover:text-white">Produto</Link>
            <Link href="#integracoes" className="transition-colors hover:text-white">Integrações</Link>
            <Link href="#faq" className="transition-colors hover:text-white">Documentação</Link>
            <Link href="/login" className="transition-colors hover:text-white">Suporte</Link>
            <Link href="#como-funciona" className="transition-colors hover:text-white">Funcionalidades</Link>
            <Link href="/register" className="transition-colors hover:text-white">Preços</Link>
            <Link href="/register" className="transition-colors hover:text-white">Termos</Link>
            <Link href="/register" className="transition-colors hover:text-white">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
