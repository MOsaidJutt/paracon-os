import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.permissions.includes("project.view")) redirect("/dashboard");

  return <div className="flex flex-col gap-6">{children}</div>;
}
