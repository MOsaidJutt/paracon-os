import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FinanceHub } from "@/components/finance/finance-hub";

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.permissions.includes("finance.view")) redirect("/dashboard");

  return <FinanceHub canEdit={session.user.permissions.includes("finance.edit")} />;
}
