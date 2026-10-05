import Link from "next/link";
import { ArrowRight, BadgeCheck, Bot, Check, CreditCard, FileText, MessageCircle, Radio, ShoppingBag, Sparkles, UsersRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { LandingNavigation } from "@/components/LandingNavigation";
import { LandingCalculator } from "@/components/LandingCalculator";
import { LandingPhoneMockup } from "@/components/LandingPhoneMockup";

const features = [
  { icon: Bot, title: "Bots Telegram", description: "Conecte e gerencie vários bots em um painel da sua conta." },
  { icon: ShoppingBag, title: "Acessos e produtos", description: "Venda convites para grupos e canais ou entregue links externos." },
  { icon: CreditCard, title: "PIX no checkout", description: "Gere cobranças PIX pelo Mercado Pago, AmploPay ou PIX Direto." },
  { icon: FileText, title: "Order bump", description: "Ofereça um item complementar antes de criar a cobrança." },
  { icon: MessageCircle, title: "Boas-vindas", description: "Configure mensagem, fotos e vídeos enviados no início da conversa." },
  { icon: Radio, title: "Remarketing", description: "Agende mensagens para leads e configure descontos por oferta." },
  { icon: UsersRound, title: "Clientes e acessos", description: "Acompanhe leads, pedidos e acessos associados aos seus bots." },
  { icon: BadgeCheck, title: "Vendas e métricas", description: "Consulte pagamentos, receita e desempenho por período." },
];

const gateways = [
  { name: "Mercado Pago", state: "Disponível", detail: "PIX, consulta de status e webhook." },
  { name: "AmploPay", state: "Disponível", detail: "Geração PIX via API e retorno de webhook." },
  { name: "PIX Direto", state: "Disponível", detail: "QR Code e análise manual do comprovante." },
  { name: "Pushin Pay", state: "Em breve", detail: "Aguardando validação de documentação e eventos." },
  { name: "Átomo Pay", state: "Em breve", detail: "Aguardando validação de documentação e eventos." },
  { name: "Nexus Wallet", state: "Em breve", detail: "Aguardando validação de documentação e eventos." },
  { name: "Sync Pay", state: "Em breve", detail: "Aguardando validação de documentação e eventos." },
  { name: "Stripe", state: "Em breve", detail: "API documentada; checkout e confirmação ainda não integrados." },
  { name: "Oasy Pay", state: "Em breve", detail: "Aguardando validação de documentação e eventos." },
];

const steps = [
  ["01", "Crie seu bot", "Conecte seu bot do Telegram ao painel."],
  ["02", "Cadastre suas ofertas", "Escolha acesso a grupo/canal ou produto por link externo."],
  ["03", "Configure o pagamento", "Selecione Mercado Pago, AmploPay ou PIX Direto já disponível."],
  ["04", "Personalize a conversa", "Defina mensagem de boas-vindas e mídias do bot."],
  ["05", "Divulgue seu bot", "Compartilhe o link do bot com seus clientes."],
  ["06", "Entregue após confirmar", "O sistema libera o acesso após confirmação do gateway; PIX Direto pede revisão manual."],
];

const faq = [
  { question: "O que é o ODISSEIA BOT?", answer: "Uma plataforma para conectar bots do Telegram, cadastrar ofertas, receber pedidos e gerenciar entregas e relacionamento com clientes." },
  { question: "Preciso saber programar?", answer: "Não. A configuração de bots, ofertas, mensagens e gateways disponíveis é feita pelo painel." },
  { question: "Posso conectar meu próprio bot do Telegram?", answer: "Sim. Você conecta um bot usando o token emitido pelo BotFather. O token é usado apenas no servidor." },
  { question: "Quais gateways posso usar?", answer: "Mercado Pago, AmploPay e PIX Direto estão presentes no checkout. Os demais aparecem como em breve e não processam pagamentos ainda." },
  { question: "Posso receber por PIX?", answer: "Sim. Mercado Pago e AmploPay geram cobranças PIX. PIX Direto gera QR Code e o comprovante precisa de revisão manual." },
  { question: "Posso vender assinaturas recorrentes?", answer: "Ainda não. Atualmente o sistema processa compras individuais e acessos com duração configurável." },
  { question: "O cliente recebe o acesso automaticamente?", answer: "Após confirmação do pagamento pelos webhooks integrados, o bot envia links de convite para grupos/canais ou o link externo do produto." },
  { question: "Posso vender em grupos e canais privados?", answer: "Sim. O bot precisa ser administrador e ter permissão para gerar links de convite." },
  { question: "Quanto custa?", answer: "A proposta promocional é uma taxa fixa de R$ 0,30 por venda. A cobrança automática dessa taxa ainda não está implementada no checkout." },
  { question: "Posso cancelar minha conta?", answer: "Você pode interromper o uso dos bots e remover as integrações. Para exclusão de dados da conta, entre em contato com o suporte do serviço." },
  { question: "Como funciona a taxa de R$ 0,30?", answer: "É uma proposta de preço fixo por venda, não uma porcentagem. A simulação abaixo permite comparar esse valor com uma taxa percentual hipotética." },
];

export function LandingContent() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#f5f5f5] selection:bg-blue-500/30">
      <header className="sticky top-0 z-50 border-b border-[#202020] bg-[#050505]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0 text-lg sm:text-xl"><Brand className="text-white" /></Link>
          <LandingNavigation />
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-9 px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16 lg:min-h-[680px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:py-12 xl:gap-12">
          <div className="relative z-10 max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#252525] bg-[#0b0b0b] px-3 py-1.5 text-xs font-medium text-[#a8c8ff]"><Sparkles aria-hidden="true" className="size-3.5 text-[#2f80ff]" /> Operação de vendas integrada ao Telegram</p>
            <h1 aria-label="Venda conteúdos e acessos automaticamente pelo Telegram." className="mt-6 max-w-[680px] text-[36px] font-bold leading-[1.08] text-white sm:text-[54px] lg:text-[46px] xl:text-[54px] 2xl:text-[60px]">
              <span aria-hidden="true" className="hidden sm:block">Venda conteúdos e</span>
              <span aria-hidden="true" className="hidden sm:block">acessos</span>
              <span aria-hidden="true" className="hidden sm:block">automaticamente pelo</span>
              <span aria-hidden="true" className="block sm:hidden">Venda conteúdos</span>
              <span aria-hidden="true" className="block sm:hidden">e acessos</span>
              <span aria-hidden="true" className="block sm:hidden">automaticamente</span>
              <span aria-hidden="true" className="block sm:hidden">pelo</span>
              <span className="block text-[#1683ff]">Telegram.</span>
            </h1>
            <p className="mt-5 max-w-[600px] text-base leading-relaxed text-[#8b9aaa] sm:text-lg">Crie seu bot, cadastre ofertas, conecte um gateway disponível e automatize pagamentos PIX, entrega de acessos e relacionamento com clientes.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/register"><Button size="lg" className="h-12 w-full gap-2 rounded-lg bg-[#087bff] px-6 text-white shadow-[0_8px_28px_rgba(8,123,255,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#168cff] hover:shadow-[0_8px_32px_rgba(8,123,255,0.36)] sm:w-auto">Começar agora <ArrowRight aria-hidden="true" className="size-4" /></Button></Link>
              <Link href="#como-funciona"><Button size="lg" variant="outline" className="h-12 w-full rounded-lg border-[#303030] bg-[#080b0f] px-6 text-white transition-all hover:-translate-y-0.5 hover:border-[#27507b] hover:bg-[#0d1722] sm:w-auto">Ver como funciona</Button></Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#8b9aaa]">
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-3.5 text-[#2299ff]" /> Acessos e links externos</span>
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-3.5 text-[#2299ff]" /> PIX nos gateways disponíveis</span>
            </div>
          </div>

          <LandingPhoneMockup />
        </section>

        <section id="recursos" className="scroll-mt-20 border-y border-[#1b1b1b] bg-[#080808]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5594ff]">Recursos</p><h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Da conversa ao acesso, no mesmo fluxo.</h2><p className="mt-3 text-sm leading-relaxed text-[#858585]">Ferramentas para operar ofertas e bots, sem prometer recursos que ainda não estão disponíveis.</p></div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{features.map(({ icon: Icon, title, description }) => <article key={title} className="rounded-xl border border-[#202020] bg-[#0b0b0b] p-5 transition-colors hover:border-[#343434]"><span className="flex size-9 items-center justify-center rounded-lg border border-[#1d2b3d] bg-[#101722] text-[#5594ff]"><Icon aria-hidden="true" className="size-[18px]" /></span><h3 className="mt-4 text-sm font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#858585]">{description}</p></article>)}</div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5594ff]">Como funciona</p><h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Uma operação simples, em seis etapas.</h2></div>
          <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{steps.map(([number, title, description]) => <li key={number} className="flex gap-4 rounded-xl border border-[#1f1f1f] bg-[#090909] p-5"><span className="font-mono text-sm text-[#2f80ff]">{number}</span><div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#858585]">{description}</p></div></li>)}</ol>
        </section>

        <section id="integracoes" className="scroll-mt-20 border-y border-[#1b1b1b] bg-[#080808]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5594ff]">Integrações</p><h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Gateways com status transparente.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#858585]">Somente os gateways marcados como disponíveis processam pagamentos atualmente.</p></div><Link href="/register" className="inline-flex items-center gap-2 text-sm font-medium text-[#9cc2ff] hover:text-white">Conectar uma conta <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gateways.map((gateway) => <article key={gateway.name} className="flex min-h-32 flex-col justify-between rounded-xl border border-[#202020] bg-[#0b0b0b] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white">{gateway.name}</h3><span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${gateway.state === "Disponível" ? "border-[#16452f] bg-[#0b1f14] text-[#61d49a]" : "border-[#303030] bg-[#141414] text-[#999]"}`}>{gateway.state}</span></div><p className="mt-3 text-xs leading-relaxed text-[#858585]">{gateway.detail}</p></article>)}</div>
          </div>
        </section>

        <section id="precos" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5594ff]">Preços</p><h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Taxa fixa, não porcentagem.</h2><p className="mt-3 text-sm leading-relaxed text-[#858585]">A proposta promocional de lançamento é uma taxa fixa por venda, independente do valor do produto.</p></div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-[#20412f] bg-[#09130d] p-6 sm:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#61d49a]"><Zap aria-hidden="true" className="size-4" /> Promoção de lançamento</div><p className="mt-5 text-4xl font-semibold tabular-nums text-white">R$ 0,30</p><p className="mt-1 text-sm font-medium text-[#b6e8ce]">por venda · taxa fixa</p><p className="mt-4 text-sm leading-relaxed text-[#8c9b91]">O ODISSEIA BOT propõe cobrar uma taxa fixa de R$ 0,30 por venda durante a promoção de lançamento. A cobrança automática dessa taxa ainda não está integrada ao checkout.</p></article>
            <article className="rounded-xl border border-[#242424] bg-[#0a0a0a] p-6 sm:p-8"><div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a8a8a]">Modelo percentual</div><p className="mt-5 text-2xl font-semibold text-white">Uma porcentagem do valor vendido</p><p className="mt-3 text-sm leading-relaxed text-[#858585]">As taxas de outras plataformas variam. Não atribuímos valores a concorrentes sem uma fonte oficial atual; use a calculadora como cenário hipotético.</p><Link href="#calculadora" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#9cc2ff] hover:text-white">Simular valores <ArrowRight aria-hidden="true" className="size-4" /></Link></article>
          </div>
          <div id="calculadora" className="scroll-mt-24 mt-5 rounded-xl border border-[#202020] bg-[#080808] p-5 sm:p-7"><div className="mb-5"><h3 className="text-lg font-semibold text-white">Simule o custo por venda</h3><p className="mt-1 text-sm text-[#858585]">Compare a proposta fixa com uma taxa percentual hipotética.</p></div><LandingCalculator /></div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-[#1b1b1b] bg-[#080808]">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5594ff]">FAQ</p><h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Perguntas frequentes</h2><div className="mt-8 divide-y divide-[#222] border-y border-[#222]">{faq.map((item) => <details key={item.question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-medium text-[#e5e5e5] marker:hidden"><span>{item.question}</span><span aria-hidden="true" className="text-lg text-[#777] transition-transform group-open:rotate-45">+</span></summary><p className="max-w-3xl pt-3 text-sm leading-relaxed text-[#888]">{item.answer}</p></details>)}</div></div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6"><div className="flex flex-col gap-5 rounded-xl border border-[#1e2b3c] bg-[#0b1119] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div><p className="text-xl font-semibold text-white">Organize suas vendas no Telegram.</p><p className="mt-2 text-sm text-[#888]">Conecte um bot e configure as ofertas do seu negócio.</p></div><Link href="/register"><Button className="h-11 gap-2 rounded-lg bg-[#2f80ff] px-5 text-white hover:bg-[#1677ff]">Criar conta <ArrowRight aria-hidden="true" className="size-4" /></Button></Link></div></section>
      </main>

      <footer className="border-t border-[#1c1c1c] px-4 py-6 text-xs text-[#777] sm:px-6"><div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Brand className="text-slate-300" /><p>© 2026 ODISSEIA BOT · Pagamentos e funcionalidades conforme disponibilidade no painel.</p></div></footer>
    </div>
  );
}
