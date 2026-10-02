import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { Telegraf, Input } from "telegraf";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();
const maxFileSize = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const botId = formData.get("botId");
  const file = formData.get("file");
  if (typeof botId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ message: "Selecione um arquivo de imagem ou vídeo." }, { status: 400 });
  }
  if (file.size > maxFileSize) {
    return NextResponse.json({ message: "O arquivo deve ter no máximo 20 MB." }, { status: 400 });
  }

  const mediaType = file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : null;
  if (!mediaType) return NextResponse.json({ message: "Formato não suportado. Envie imagem ou vídeo." }, { status: 400 });

  const botRecord = await prisma.bot.findFirst({
    where: { id: botId, workspace: { userId } },
  });
  if (!botRecord) return NextResponse.json({ message: "Bot não encontrado" }, { status: 404 });
  if (!botRecord.storageChatId) {
    return NextResponse.json({ message: "Configure o canal de armazenamento de mídia nas boas-vindas do bot primeiro." }, { status: 400 });
  }

  const bot = new Telegraf(botRecord.token);
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const media = mediaType === "photo"
      ? await bot.telegram.sendPhoto(botRecord.storageChatId, Input.fromBuffer(buffer, file.name))
      : await bot.telegram.sendVideo(botRecord.storageChatId, Input.fromBuffer(buffer, file.name));
    const mediaFileId = mediaType === "photo" ? media.photo[media.photo.length - 1].file_id : media.video.file_id;
    return NextResponse.json({ mediaFileId, mediaType });
  } catch (error) {
    console.error("Erro ao enviar mídia de remarketing ao Telegram:", error);
    return NextResponse.json({ message: "Não foi possível enviar a mídia ao canal de armazenamento." }, { status: 400 });
  }
}