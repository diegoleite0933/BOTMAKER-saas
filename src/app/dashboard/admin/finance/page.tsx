import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/account-security";
import { FinanceConsole } from "./FinanceConsole";

export default async function PlatformFinancePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; isBanned?: boolean } | undefined;
  if (!user?.id || user.isBanned || !isAdminEmail(session?.user?.email)) redirect("/dashboard");
  return <FinanceConsole />;
}