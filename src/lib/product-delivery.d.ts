import type { PrismaClient } from "@prisma/client";
import type { Telegraf } from "telegraf";

type DeliveryProduct = {
  id: string;
  name: string;
  deliveries: {
    id: string;
    type: string;
    telegramChatId: string | null;
    content: string | null;
    durationDays: number | null;
  }[];
};

type PaidOrder = {
  id: string;
  botId: string;
  telegramUserId: string;
  product: DeliveryProduct;
  bumpProduct: DeliveryProduct | null;
};

export function deliverPaidOrder(input: {
  prisma: PrismaClient;
  bot: Telegraf;
  order: PaidOrder;
}): Promise<boolean>;