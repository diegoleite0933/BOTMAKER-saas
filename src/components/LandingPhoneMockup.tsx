import { Crown, Headphones, LockKeyhole, Menu, MessageCircle, Paperclip, Send, Signal, Wifi } from "lucide-react";
import { HelmetMark } from "@/components/Brand";

const notifications = [
  { kind: "approved", title: "Venda aprovada!", value: "Sua comissão: R$ 32,24" },
  { kind: "pending", title: "Boleto gerado", value: "Sua comissão: R$ 13,44" },
  { kind: "approved", title: "Venda aprovada!", value: "Sua comissão: R$ 94,26" },
];

const botOptions = [
  { icon: Crown, title: "Conteúdos Premium", description: "Acesse nossos conteúdos exclusivos" },
  { icon: LockKeyhole, title: "Grupos VIP", description: "Entre nos nossos grupos exclusivos" },
  { icon: Headphones, title: "Suporte", description: "Tire suas dúvidas" },
];

export function LandingPhoneMockup() {
  return (
    <div className="landing-phone-scene relative mx-auto w-full max-w-[570px] px-1 py-5 sm:px-4 sm:py-8">
      <div aria-hidden="true" className="landing-phone-halo absolute inset-x-[13%] top-[12%] h-[68%] rounded-full" />
      <div className="landing-phone-float relative z-20 mx-auto w-[min(278px,68vw)] rounded-[43px] border border-[#4d6f91] bg-[linear-gradient(145deg,#12263a_0%,#05090e_18%,#020407_83%,#28527b_100%)] p-[6px] shadow-[0_28px_70px_rgba(0,0,0,0.8),0_0_34px_rgba(22,131,255,0.24)] sm:w-[286px] xl:-translate-x-[112px]">
        <div className="relative h-[530px] overflow-hidden rounded-[37px] border border-[#142536] bg-[#03070b] sm:h-[554px]">
          <div aria-hidden="true" className="absolute left-1/2 top-2 z-30 h-[22px] w-[104px] -translate-x-1/2 rounded-full border border-[#172536] bg-black" />
          <div className="flex h-8 items-center justify-between px-5 pt-1 text-[9px] font-semibold text-white/90">
            <span>9:41</span>
            <span className="flex items-center gap-1"><Signal className="size-3" /><Wifi className="size-3" /><span className="ml-0.5 h-2.5 w-4 rounded-[3px] border border-white/70"><span className="m-[2px] block h-1 w-2 rounded-[1px] bg-white" /></span></span>
          </div>

          <div className="flex h-[57px] items-center gap-3 border-b border-white/[0.06] px-4">
            <Menu aria-hidden="true" className="size-[17px] text-[#9cadbd]" />
            <div className="flex items-center gap-2"><HelmetMark className="size-7" /><span><span className="block text-[11px] font-semibold text-white">OdisseiaBot</span><span className="mt-0.5 block text-[8px] text-[#7b8d9f]">bot</span></span></div>
            <span className="ml-auto flex size-7 items-center justify-center rounded-full border border-[#16283b] bg-[#0c1420] text-[#5aa9ff]"><MessageCircle aria-hidden="true" className="size-3.5" /></span>
          </div>

          <div className="px-3.5 pt-4">
            <div className="mb-3 flex justify-end"><span className="rounded-full border border-[#142332] bg-[#0b121b] px-2.5 py-1 text-[9px] text-[#8193a6]">Hoje, 9:41</span></div>
            <div className="max-w-[92%] rounded-[15px] rounded-tl-[5px] border border-[#172536] bg-[linear-gradient(145deg,#101b28,#0a111a)] px-3.5 py-3 shadow-[0_10px_25px_rgba(0,0,0,0.28)]">
              <p className="text-[13px] font-semibold text-white">Bem-vindo! <span aria-hidden="true">👋</span></p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#9aaabd]">Escolha o que deseja acessar:</p>
              <p className="mt-2 text-right text-[8px] text-[#536477]">09:41</p>
            </div>

            <div className="mt-3 space-y-2">
              {botOptions.map(({ icon: Icon, title, description }) => (
                <div key={title} className="group flex items-center gap-2.5 rounded-[13px] border border-[#1a2a3b] bg-[linear-gradient(110deg,#0d1722,#0a1119)] px-2.5 py-3 transition-colors hover:border-[#1b6fc2]/70 hover:bg-[#0d1927]">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[#153453] bg-[#0b2035] text-[#46a2ff]"><Icon aria-hidden="true" className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-[#eef5fc]">{title}</span><span className="mt-0.5 block truncate text-[8px] text-[#8292a4]">{description}</span></span>
                  <span className="text-base leading-none text-[#8292a4]">›</span>
                </div>
              ))}
            </div>

            <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.06] bg-[#05090e] px-3 py-3">
              <div className="flex items-center gap-2 rounded-full border border-[#1d2b3b] bg-[#0a1119] py-1.5 pl-2.5 pr-1.5">
                <Paperclip aria-hidden="true" className="size-3.5 shrink-0 text-[#71859a]" />
                <span className="flex-1 text-[9px] text-[#66788b]">Mensagem...</span>
                <span className="flex size-7 items-center justify-center rounded-full bg-[#087bff] text-white shadow-[0_0_15px_rgba(8,123,255,0.38)]"><Send aria-hidden="true" className="size-3 -rotate-12" fill="currentColor" /></span>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="absolute bottom-1 left-1/2 h-[3px] w-24 -translate-x-1/2 rounded-full bg-white/55" />
        </div>
      </div>

      <div className="landing-notifications z-30 mx-auto mt-4 grid w-full max-w-[286px] gap-2 xl:absolute xl:right-1 xl:top-[20%] xl:mt-0 xl:w-[224px]">
        {notifications.map((notification, index) => (
          <div key={`${notification.title}-${notification.value}`} className={`landing-toast landing-toast-${index + 1} flex items-center gap-2 rounded-[15px] border border-[#293849] bg-[linear-gradient(115deg,rgba(10,16,23,0.96),rgba(3,7,11,0.94))] px-2.5 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.55)] backdrop-blur-xl`}>
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-[#1b4e7b] bg-[#0c2135] text-[#4aa7ff] shadow-[0_0_16px_rgba(22,131,255,0.2)]"><HelmetMark className="size-5" /><span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-[#07120d] bg-[#00d084]" /></span>
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-[9px] font-semibold text-white">ODISSEIABOT</span><span className="text-[7px] text-[#697a8b]">agora</span></span><span className="mt-0.5 block text-[8px] font-medium text-[#e7edf3]">{notification.title}</span><span className="mt-0.5 block truncate text-[7px] text-[#95a7b8]">{notification.value}</span></span>
          </div>
        ))}
      </div>

    </div>
  );
}
