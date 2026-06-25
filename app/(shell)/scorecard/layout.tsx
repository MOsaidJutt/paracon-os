import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function ScorecardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.permissions.includes("scorecard.view")) redirect("/dashboard");

  return <div className="flex flex-col gap-6">{children}</div>;
}
