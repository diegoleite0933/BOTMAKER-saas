import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getBot } from "@/lib/telegram-bot";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const url = new URL(req.url);
  const botId = url.searchParams.get('botId');

  if (!botId) {
    return NextResponse.json({ error: 'Missing botId' }, { status: 400 });
  }

  try {
    const update = await req.json();

    if (!update || typeof update !== "object" || !("update_id" in update)) {
      return NextResponse.json({ error: "Webhook payload inválido." }, { status: 400 });
    }

    // Check if duplicate webhook (idempotency)
    const eventId = String(update.update_id);
    const existing = await prisma.webhookEvent.findUnique({
      where: { source_eventId: { source: 'telegram', eventId } }
    });

    if (existing) {
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    // Save event
    await prisma.webhookEvent.create({
      data: {
        source: 'telegram',
        eventId,
        payload: JSON.stringify(update),
        status: 'pending'
      }
    });

    const botRecord = await prisma.bot.findUnique({ where: { id: botId } });
    if (!botRecord) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const bot = getBot(botRecord);

    // Process Update
    await bot.handleUpdate(update);

    await prisma.webhookEvent.update({
      where: { source_eventId: { source: 'telegram', eventId } },
      data: { status: 'processed' }
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Telegram Webhook Error:", err);
    return NextResponse.json({ error: 'Internal Error', message }, { status: 500 });
  }
}
