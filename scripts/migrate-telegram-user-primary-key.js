const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function migrateTelegramUserPrimaryKey() {
  const tableState = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('"TelegramUser"') IS NOT NULL AS exists`,
  );
  if (!tableState[0]?.exists) return;

  await prisma.$transaction(async (transaction) => {
    const primaryKeyRows = await transaction.$queryRawUnsafe(`
      SELECT array_agg(attribute.attname ORDER BY key_column.ordinality) AS columns
      FROM pg_constraint AS constraint_info
      JOIN LATERAL unnest(constraint_info.conkey) WITH ORDINALITY AS key_column(attnum, ordinality) ON true
      JOIN pg_attribute AS attribute
        ON attribute.attrelid = constraint_info.conrelid
        AND attribute.attnum = key_column.attnum
      WHERE constraint_info.conrelid = '"TelegramUser"'::regclass
        AND constraint_info.contype = 'p'
      GROUP BY constraint_info.oid
    `);
    const columns = primaryKeyRows[0]?.columns || [];

    if (columns.length === 2 && columns[0] === "id" && columns[1] === "botId") return;
    if (columns.length !== 1 || columns[0] !== "id") {
      throw new Error(`Unexpected TelegramUser primary key: ${columns.join(",") || "missing"}`);
    }

    const duplicate = await transaction.$queryRawUnsafe(`
      SELECT "id", "botId"
      FROM "TelegramUser"
      GROUP BY "id", "botId"
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (duplicate.length) throw new Error("Duplicate TelegramUser composite keys prevent migration.");

    await transaction.$executeRawUnsafe(`ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_telegramUserId_botId_fkey"`);
    await transaction.$executeRawUnsafe(`ALTER TABLE "Access" DROP CONSTRAINT IF EXISTS "Access_telegramUserId_botId_fkey"`);
    await transaction.$executeRawUnsafe(`ALTER TABLE "RemarketingSend" DROP CONSTRAINT IF EXISTS "RemarketingSend_telegramUserId_botId_fkey"`);
    await transaction.$executeRawUnsafe(`ALTER TABLE "TelegramUser" DROP CONSTRAINT "TelegramUser_pkey"`);
    await transaction.$executeRawUnsafe(`DROP INDEX IF EXISTS "TelegramUser_id_botId_key"`);
    await transaction.$executeRawUnsafe(`ALTER TABLE "TelegramUser" ADD CONSTRAINT "TelegramUser_pkey" PRIMARY KEY ("id", "botId")`);
    await transaction.$executeRawUnsafe(`
      ALTER TABLE "Order"
      ADD CONSTRAINT "Order_telegramUserId_botId_fkey"
      FOREIGN KEY ("telegramUserId", "botId") REFERENCES "TelegramUser" ("id", "botId")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await transaction.$executeRawUnsafe(`
      ALTER TABLE "Access"
      ADD CONSTRAINT "Access_telegramUserId_botId_fkey"
      FOREIGN KEY ("telegramUserId", "botId") REFERENCES "TelegramUser" ("id", "botId")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await transaction.$executeRawUnsafe(`
      ALTER TABLE "RemarketingSend"
      ADD CONSTRAINT "RemarketingSend_telegramUserId_botId_fkey"
      FOREIGN KEY ("telegramUserId", "botId") REFERENCES "TelegramUser" ("id", "botId")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  });
}

migrateTelegramUserPrimaryKey()
  .then(() => console.log("TelegramUser composite primary key is ready."))
  .catch((error) => {
    console.error("Failed to migrate TelegramUser primary key:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());