import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { createMarketplaceAuthorizationUrl } from "@/lib/mercadopago-marketplace.js";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isBanned?: boolean } | undefined;
  if (!user?.id || user.isBanned) return NextResponse.redirect(new URL("/login", process.env.APP_URL || "http://localhost:3000"));

  const workspace = await prisma.workspace.findFirst({ where: { userId: user.id }, select: { id: true } });
  if (!workspace) {
    return NextResponse.redirect(new URL("/dashboard/integrations?mercadopago=workspace_required", process.env.APP_URL || "http://localhost:3000"));
  }

  try {
    const authorizationUrl = await createMarketplaceAuthorizationUrl(prisma, { userId: user.id, workspaceId: workspace.id });
    return NextResponse.redirect(authorizationUrl);
  } catch {
    return NextResponse.redirect(new URL("/dashboard/integrations?mercadopago=marketplace_unavailable", process.env.APP_URL || "http://localhost:3000"));
  }
}