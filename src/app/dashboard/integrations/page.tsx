import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { IntegrationSettings } from "./IntegrationSettings";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isBanned?: boolean } | undefined;
  if (!user?.id || user.isBanned) redirect("/login");

  return <IntegrationSettings />;
}
