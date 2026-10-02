import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { Telegraf, Input } from "telegraf";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const botId = formData.get("botId");
    const msg = formData.get("msg");
    const storageChatId = formData.get("storageChatId");
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    const legacyFile = formData.get("file");
    if (legacyFile instanceof File) files.push(legacyFile);
    const clearMedia = formData.get("clearMedia") === "true";
    const replaceMedia = formData.get("replaceMedia") === "true" || clearMedia || files.length > 0;

    if (typeof botId !== "string" || !botId) return NextResponse.json({ message: "Missing botId" }, { status: 400 });
    if (typeof msg !== "string" || typeof storageChatId !== "string") {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }
    if (files.length > 3) {
      return NextResponse.json({ message: "Selecione no máximo 3 mídias." }, { status: 400 });
    }
    if (files.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) {
      return NextResponse.json({ message: "Envie apenas imagens ou vídeos." }, { status: 400 });
    }
    if (files.some((file) => file.size > 20 * 1024 * 1024)) {
      return NextResponse.json({ message: "Cada arquivo deve ter no máximo 20 MB." }, { status: 400 });
    }
    if (files.length > 0 && !storageChatId) {
      return NextResponse.json({ message: "Para enviar arquivos, preencha o ID do Banco de Imagens." }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: { userId }
    });

    if (!workspace) return NextResponse.json({ message: "Workspace not found" }, { status: 404 });

    const botRecord = await prisma.bot.findFirst({
      where: { id: botId, workspaceId: workspace.id }
    });

    if (!botRecord) return NextResponse.json({ message: "Bot not found" }, { status: 404 });

    const uploadedMedia: { fileId: string; mediaType: "photo" | "video" }[] = [];
    if (files.length > 0) {
      const bot = new Telegraf(botRecord.token);

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        try {
          if (file.type.startsWith("video/")) {
            const result = await bot.telegram.sendVideo(storageChatId, Input.fromBuffer(buffer, file.name));
            uploadedMedia.push({ fileId: result.video.file_id, mediaType: "video" });
          } else {
            const result = await bot.telegram.sendPhoto(storageChatId, Input.fromBuffer(buffer, file.name));
            uploadedMedia.push({ fileId: result.photo[result.photo.length - 1].file_id, mediaType: "photo" });
          }
        } catch (error) {
          console.error("Telegram Upload Error:", error);
          return NextResponse.json({ message: "Erro ao enviar para o Telegram. O bot é Admin do grupo?" }, { status: 400 });
        }
      }
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.bot.update({
        where: { id: botId },
        data: {
          welcomeMessage: msg || null,
          storageChatId: storageChatId || null,
          ...(replaceMedia ? {
            welcomeMediaId: uploadedMedia[0]?.fileId || null,
            welcomeMediaType: uploadedMedia[0]?.mediaType || null,
          } : {}),
        },
      });

      if (replaceMedia) {
        await transaction.welcomeMedia.deleteMany({ where: { botId } });
        if (uploadedMedia.length > 0) {
          await transaction.welcomeMedia.createMany({
            data: uploadedMedia.map((media, position) => ({ ...media, botId, position })),
          });
        }
      }
    });

    return NextResponse.json({
      message: "Success",
      media: replaceMedia ? uploadedMedia.map((media, position) => ({ ...media, position })) : undefined,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}
