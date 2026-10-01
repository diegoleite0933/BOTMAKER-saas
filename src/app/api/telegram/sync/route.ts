import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = process.env.APP_URL || url.origin;
    
    const bots = await prisma.bot.findMany();
    
    for (const bot of bots) {
      const webhookUrl = `${baseUrl}/api/telegram/webhook?botId=${bot.id}`;
      const response = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      console.log(`Webhook set for bot ${bot.name}:`, await response.json());
    }

    return NextResponse.json({ message: "Webhooks synchronized for all bots", baseUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
