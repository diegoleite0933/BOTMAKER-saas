import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();
const maxCampaignsPerBot = 10;
type CampaignData = {
  name: string;
  message: string | null;
  delayDays: number;
  mediaFileId: string | null;
  mediaType: "photo" | "video" | null;
  isActive: boolean;
};

async function getOwnedBot(botId: unknown, userId: string) {
  if (typeof botId !== "string" || !botId) return null;
  return prisma.bot.findFirst({
    where: { id: botId, workspace: { userId } },
    select: { id: true },
  });
}

function parseCampaign(body: Record<string, unknown>): { ok: true; value: CampaignData } | { ok: false; message: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const delayDays = Number(body.delayDays);
  const mediaFileId = typeof body.mediaFileId === "string" ? body.mediaFileId : "";
  const mediaType = body.mediaType === "photo" || body.mediaType === "video" ? body.mediaType : null;
  const isActive = body.isActive === true;

  if (!name || name.length > 80) return { ok: false, message: "Dê um nome à campanha (até 80 caracteres)." };
  if (!Number.isInteger(delayDays) || delayDays < 1 || delayDays > 365) {
    return { ok: false, message: "O intervalo deve ser de 1 a 365 dias após o pagamento." };
  }
  if (message.length > 1000) return { ok: false, message: "A mensagem pode ter no máximo 1000 caracteres." };
  if (mediaFileId && !mediaType) return { ok: false, message: "Tipo de mídia inválido." };
  if (isActive && !message && !mediaFileId) return { ok: false, message: "Adicione uma mensagem ou mídia antes de ativar." };

  return { ok: true, value: { name, message: message || null, delayDays, mediaFileId: mediaFileId || null, mediaType, isActive } };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const botId = new URL(request.url).searchParams.get("botId");
  const bot = await getOwnedBot(botId, userId);
  if (!bot) return NextResponse.json({ message: "Bot não encontrado" }, { status: 404 });

  const campaigns = await prisma.remarketing.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const bot = await getOwnedBot(body.botId, userId);
  if (!bot) return NextResponse.json({ message: "Bot não encontrado" }, { status: 404 });

  const count = await prisma.remarketing.count({ where: { botId: bot.id } });
  if (count >= maxCampaignsPerBot) {
    return NextResponse.json({ message: "Cada bot pode ter no máximo 10 remarketings." }, { status: 409 });
  }

  const parsed = parseCampaign(body);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });

  const campaign = await prisma.remarketing.create({ data: { ...parsed.value, botId: bot.id } });
  return NextResponse.json({ campaign }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const bot = await getOwnedBot(body.botId, userId);
  if (!bot || typeof body.id !== "string") {
    return NextResponse.json({ message: "Campanha não encontrada" }, { status: 404 });
  }

  const parsed = parseCampaign(body);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  const result = await prisma.remarketing.updateMany({
    where: { id: body.id, botId: bot.id },
    data: parsed.value,
  });
  if (!result.count) return NextResponse.json({ message: "Campanha não encontrada" }, { status: 404 });

  const campaign = await prisma.remarketing.findUnique({ where: { id: body.id } });
  return NextResponse.json({ campaign });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const bot = await getOwnedBot(body.botId, userId);
  if (!bot || typeof body.id !== "string") {
    return NextResponse.json({ message: "Campanha não encontrada" }, { status: 404 });
  }

  const result = await prisma.remarketing.deleteMany({ where: { id: body.id, botId: bot.id } });
  if (!result.count) return NextResponse.json({ message: "Campanha não encontrada" }, { status: 404 });
  return NextResponse.json({ message: "Remarketing removido." });
}