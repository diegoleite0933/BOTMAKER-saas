import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { ProductEditor } from "./ProductEditor";

const prisma = new PrismaClient();

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) notFound();

  const { id } = await params;
  const workspace = await prisma.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!workspace) notFound();

  const [product, bots] = await Promise.all([
    prisma.product.findFirst({
      where: { id, bot: { workspaceId: workspace.id } },
      include: { deliveries: { take: 1 } },
    }),
    prisma.bot.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true, username: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) notFound();

  return (
    <ProductEditor
      bots={bots}
      product={{
        id: product.id,
        name: product.name,
        description: product.description || "",
        price: product.price,
        status: product.status,
        botId: product.botId,
        delivery: product.deliveries[0] || null,
      }}
    />
  );
}