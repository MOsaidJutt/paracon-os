import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/admin-tabs";

const TABS = [
  { href: "/admin/users", label: "Users", permission: "admin.users" },
  { href: "/admin/roles", label: "Roles & Permissions", permission: "admin.roles" },
  { href: "/admin/ai-settings", label: "AI Settings", permission: "admin.ai" },
  { href: "/admin/ai-usage", label: "AI Usage", permission: "admin.ai" },
  { href: "/admin/modules", label: "Modules", permission: "admin.modules" },
  { href: "/admin/branding", label: "Branding", permission: "admin.branding" },
  { href: "/admin/audit", label: "Audit Log", permission: "admin.audit" },
  { href: "/admin/settings", label: "Settings", permission: "admin.settings" },
  { href: "/admin/document-templates", label: "Document Templates", permission: "admin.settings" },
  { href: "/admin/mailbox", label: "Accounts Inbox", permission: "admin.settings" },
  { href: "/admin/billing", label: "Billing", permission: "admin.billing" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const visibleTabs = TABS.filter((t) => session.user.permissions.includes(t.permission));
  if (visibleTabs.length === 0) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, AI configuration and organisation settings.
        </p>
      </div>

      <AdminTabs tabs={visibleTabs} />

      {children}
    </div>
  );
}
