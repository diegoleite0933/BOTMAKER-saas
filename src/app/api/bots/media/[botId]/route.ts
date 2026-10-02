import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { botId } = await params;
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId || fileId.length > 2048) return NextResponse.json({ message: "Mídia inválida." }, { status: 400 });

  const bot = await prisma.bot.findFirst({
    where: { id: botId, workspace: { userId } },
    select: { token: true },
  });
  if (!bot) return NextResponse.json({ message: "Bot não encontrado." }, { status: 404 });

  try {
    const fileInfoResponse = await fetch(`https://api.telegram.org/bot${bot.token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    if (!fileInfoResponse.ok) return NextResponse.json({ message: "Não foi possível localizar a mídia." }, { status: 404 });
    const fileInfo = await fileInfoResponse.json();
    const filePath = fileInfo?.result?.file_path;
    if (typeof filePath !== "string") return NextResponse.json({ message: "Mídia não encontrada." }, { status: 404 });

    const mediaResponse = await fetch(`https://api.telegram.org/file/bot${bot.token}/${filePath}`);
    if (!mediaResponse.ok) return NextResponse.json({ message: "Não foi possível carregar a mídia." }, { status: 502 });

    return new Response(await mediaResponse.arrayBuffer(), {
      headers: {
        "Content-Type": mediaResponse.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Erro ao carregar mídia do Telegram:", error);
    return NextResponse.json({ message: "Erro ao carregar mídia." }, { status: 502 });
  }
}