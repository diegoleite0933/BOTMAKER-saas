import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentSettingsForm } from "./PaymentSettingsForm";
import { WelcomeSettingsForm } from "./WelcomeSettingsForm";

const prisma = new PrismaClient();

export default async function BotConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);
  
  const bot = await prisma.bot.findUnique({
    where: { id: resolvedParams.id }
  });

  if (!bot) {
    redirect("/dashboard/bots");
  }

  // Verifica segurança: o bot pertence a um workspace do usuário?
  const workspace = await prisma.workspace.findFirst({
    where: { id: bot.workspaceId, userId: session?.user?.id }
  });

  if (!workspace) {
    redirect("/dashboard/bots");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configurar Bot: {bot.name}</h1>
          <p className="text-slate-500">@{bot.username}</p>
        </div>
        <Link href="/dashboard/bots" className={buttonVariants({ variant: "outline" })}>Voltar</Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status da Conexão</CardTitle>
            <CardDescription>Informações do Telegram</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-500">Status</Label>
              <div className="mt-1 font-medium text-green-600 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Conectado
              </div>
            </div>
            <div>
              <Label className="text-slate-500">Token</Label>
              <div className="mt-1 font-mono text-sm bg-slate-100 p-2 rounded truncate">
                {bot.token.substring(0, 15)}...
              </div>
            </div>
            <div>
              <Button variant="outline" className="w-full">Testar Conexão com Telegram</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entrega de Acesso (Grupo/Canal)</CardTitle>
            <CardDescription>
              Para o bot conseguir convidar quem compra, ele precisa ser Administrador do seu grupo ou canal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-blue-50 p-4">
              <div className="text-sm text-blue-700">
                <strong>Passo a passo:</strong>
                <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>Abra o seu Grupo/Canal no Telegram.</li>
                  <li>Vá em Administradores e adicione o <strong>@{bot.username}</strong>.</li>
                  <li>Dê a ele permissão de "Convidar Usuários" via Link.</li>
                </ol>
              </div>
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
              <Link href={`/dashboard/products/new?botId=${bot.id}`}>Criar Produto para este Bot</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <WelcomeSettingsForm 
          botId={bot.id} 
          initialMsg={bot.welcomeMessage} 
          initialStorageChat={bot.storageChatId} 
        />
        <PaymentSettingsForm 
          botId={bot.id} 
          initialMethod={bot.paymentMethod || "mercadopago"} 
          initialPix={bot.pixKey} 
          initialMpToken={bot.mpAccessToken} 
          initialAmploId={bot.amploPayClientId}
          initialAmploSecret={bot.amploPayClientSecret}
        />
      </div>
    </div>
  );
}
