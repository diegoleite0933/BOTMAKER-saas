import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { LandingNavigation } from "@/components/LandingNavigation";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-slate-800/50 px-3 py-3 backdrop-blur-md sm:px-6 sm:py-4">
        <Link href="/" className="min-w-0 text-lg sm:text-2xl">
          <Brand className="text-white" />
        </Link>
        <LandingNavigation />
      </header>

      <main className="flex-1 flex flex-col items-center text-center px-4 sm:px-6 lg:px-8 mt-24 mb-20 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-blue-400 bg-blue-900/30 mb-8 border border-blue-800/50 relative z-10 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
          ✨ A nova forma de monetizar comunidades
        </div>
        
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight max-w-4xl mb-8 relative z-10 leading-[1.1]">
          Venda acessos no Telegram no <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Piloto Automático</span>
        </h1>
        
        <p className="text-xl text-slate-400 max-w-2xl mb-12 relative z-10">
          Conecte seu bot, crie seus produtos e receba pagamentos via PIX. A liberação de links e mídias de boas-vindas é 100% automática.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
          <Link href="/register">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-500 h-14 px-8 text-lg rounded-full font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]">
              Criar meu primeiro Robô
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800 hover:text-white h-14 px-8 text-lg rounded-full font-semibold backdrop-blur-sm">
              Acessar Painel VIP
            </Button>
          </Link>
        </div>
        
        <div className="mt-32 grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-6xl w-full text-left relative z-10">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-2xl hover:border-slate-700 transition-colors">
            <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center mb-6 text-2xl border border-slate-700">💰</div>
            <h3 className="text-xl font-bold mb-3 text-white">Integração PIX</h3>
            <p className="text-slate-400 leading-relaxed">Integração nativa com Amplo Pay e Mercado Pago. Nós geramos o código e validamos o pagamento sem você precisar olhar o celular.</p>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-2xl hover:border-slate-700 transition-colors">
            <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center mb-6 text-2xl border border-slate-700">⚡</div>
            <h3 className="text-xl font-bold mb-3 text-white">Liberação Imediata</h3>
            <p className="text-slate-400 leading-relaxed">Pix pago? O cliente recebe o acesso na mesma hora. Você pode customizar a mensagem de boas-vindas com fotos e vídeos hospedados no próprio Telegram.</p>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-8 rounded-2xl hover:border-slate-700 transition-colors">
            <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center mb-6 text-2xl border border-slate-700">🏢</div>
            <h3 className="text-xl font-bold mb-3 text-white">Pronto para Agências</h3>
            <p className="text-slate-400 leading-relaxed">Crie vários bots diferentes dentro do mesmo painel. Perfeito para você hospedar e vender robôs para outros influenciadores.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-slate-600 border-t border-slate-800/50 relative z-10 text-sm">
        <p>© 2026 ODISSEIABOT</p>
      </footer>
    </div>
  );
}
