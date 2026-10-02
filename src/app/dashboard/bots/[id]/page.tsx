import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { PaymentSettingsForm } from "./PaymentSettingsForm";
import { WelcomeSettingsForm } from "./WelcomeSettingsForm";
import { RemarketingManager } from "./RemarketingManager";

const prisma = new PrismaClient();

export default async function BotConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string } | undefined;
  
  const bot = await prisma.bot.findUnique({
    where: { id: resolvedParams.id },
    include: {
      remarketings: { orderBy: { createdAt: "asc" } },
      welcomeMedia: { orderBy: { position: "asc" } },
    },
  });

  if (!bot) {
    redirect("/dashboard/bots");
  }

  // Verifica segurança: o bot pertence a um workspace do usuário?
  const workspace = await prisma.workspace.findFirst({
    where: { id: bot.workspaceId, userId: sessionUser?.id }
  });

  if (!workspace) {
    redirect("/dashboard/bots");
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Configurar Bot: {bot.name}</h1>
          <p className="break-all text-slate-500">@{bot.username}</p>
        </div>
        <Link href="/dashboard/bots" className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}>Voltar</Link>
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
                  <li>Dê a ele permissão de &quot;Convidar Usuários&quot; via Link.</li>
                </ol>
              </div>
            </div>
            <Link className={buttonVariants({ className: "w-full bg-blue-600 text-white hover:bg-blue-700" })} href={`/dashboard/products/new?botId=${bot.id}`}>
              Criar Produto para este Bot
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <WelcomeSettingsForm 
          botId={bot.id} 
          initialMsg={bot.welcomeMessage} 
          initialStorageChat={bot.storageChatId} 
          initialMediaCount={bot.welcomeMedia.length || (bot.welcomeMediaId ? 1 : 0)}
        />
        <PaymentSettingsForm 
          botId={bot.id} 
          initialMethod={bot.paymentMethod || "mercadopago"} 
          initialPix={bot.pixKey} 
          initialMpToken={bot.mpAccessToken} 
          initialAmploId={bot.amploPayClientId}
          initialAmploSecret={bot.amploPayClientSecret}
          initialPixReviewChatId={bot.pixReviewChatId}
        />
      </div>

      <RemarketingManager
        botId={bot.id}
        initialCampaigns={bot.remarketings.map((campaign) => ({
          ...campaign,
          delayMinutes: campaign.delayDays ? campaign.delayDays * 1440 : campaign.delayMinutes,
          delayDays: null,
        }))}
      />
    </div>
  );
}
