import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ImpersonationBanner } from "@/components/shell/impersonation-banner";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const organisation = await prisma.organisation.findUnique({
    where: { id: session.user.organisationId },
    select: { name: true, logoUrl: true },
  });
  if (!organisation) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar permissions={session.user.permissions} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {session.impersonatorId && (
          <ImpersonationBanner name={session.user.name ?? session.user.email ?? "user"} />
        )}
        <Topbar
          orgName={organisation.name}
          logoUrl={organisation.logoUrl}
          permissions={session.user.permissions}
          userName={session.user.name ?? session.user.email ?? "User"}
          userEmail={session.user.email ?? ""}
          role={session.user.role}
        />
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
