import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { Telegraf, Input } from "telegraf";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const botId = formData.get("botId") as string;
    const msg = formData.get("msg") as string;
    const storageChatId = formData.get("storageChatId") as string;
    const file = formData.get("file") as File | null;

    if (!botId) return NextResponse.json({ message: "Missing botId" }, { status: 400 });
    if (file && !storageChatId) {
      return NextResponse.json({ message: "Para enviar arquivos, preencha o ID do Banco de Imagens." }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: { userId: session.user.id }
    });

    if (!workspace) return NextResponse.json({ message: "Workspace not found" }, { status: 404 });

    const botRecord = await prisma.bot.findFirst({
      where: { id: botId, workspaceId: workspace.id }
    });

    if (!botRecord) return NextResponse.json({ message: "Bot not found" }, { status: 404 });

    let welcomeMediaId = botRecord.welcomeMediaId;
    let welcomeMediaType = botRecord.welcomeMediaType;

    if (file && storageChatId) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const bot = new Telegraf(botRecord.token);

      try {
        if (file.type.startsWith('video')) {
          const res = await bot.telegram.sendVideo(storageChatId, Input.fromBuffer(buffer, file.name));
          welcomeMediaId = res.video.file_id;
          welcomeMediaType = 'video';
        } else {
          const res = await bot.telegram.sendPhoto(storageChatId, Input.fromBuffer(buffer, file.name));
          welcomeMediaId = res.photo[res.photo.length - 1].file_id;
          welcomeMediaType = 'photo';
        }
      } catch (err: any) {
        console.error("Telegram Upload Error:", err);
        return NextResponse.json({ message: "Erro ao enviar para o Telegram. O bot é Admin do grupo?" }, { status: 400 });
      }
    }

    await prisma.bot.update({
      where: { id: botId },
      data: {
        welcomeMessage: msg || null,
        storageChatId: storageChatId || null,
        welcomeMediaId,
        welcomeMediaType
      }
    });

    return NextResponse.json({ message: "Success" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}
