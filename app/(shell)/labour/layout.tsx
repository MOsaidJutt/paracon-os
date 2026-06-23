import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function LabourLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.permissions.includes("labour.view")) redirect("/dashboard");

  return <div className="flex flex-col gap-6">{children}</div>;
}
