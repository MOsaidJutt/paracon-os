import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { isSuperAdminFeatureEnabled } from "@/lib/flags";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";

const TABS = [
  { href: "/super-admin/organisations", label: "Organisations" },
  { href: "/super-admin/ai-defaults", label: "AI Defaults" },
  { href: "/super-admin/settings", label: "Settings" },
  { href: "/super-admin/audit", label: "Audit Log" },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.permissions.includes("platform.superadmin")) redirect("/dashboard");
  if (!isSuperAdminFeatureEnabled()) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-ink px-4 lg:px-6 text-paper">
        <div className="flex items-center gap-3">
          <span className="font-heading text-base font-semibold text-paper">OneParacon — Platform</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-paper/70 hover:text-paper">
            Exit to my org
          </Link>
          <ThemeToggle />
          <UserMenu
            name={session.user.name ?? session.user.email ?? "User"}
            email={session.user.email ?? ""}
            onDarkSurface
          />
        </div>
      </header>

      <nav className="flex gap-1 border-b border-border bg-background px-4 lg:px-6">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <main className="flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
