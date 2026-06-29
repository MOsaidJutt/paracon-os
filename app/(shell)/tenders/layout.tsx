import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/admin-tabs";

const TABS = [
  { href: "/tenders", label: "Register", permission: "tender.view" },
  { href: "/tenders/templates", label: "Template", permission: "doc.edit" },
  { href: "/tenders/import", label: "Import / Export", permission: "tender.edit" },
];

export default async function TendersLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.permissions.includes("tender.view")) redirect("/dashboard");

  const visibleTabs = TABS.filter((t) => session.user.permissions.includes(t.permission));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Tender Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register, clients, suppliers and the weighted pipeline that feeds Director and PM dashboards.
        </p>
      </div>

      <AdminTabs tabs={visibleTabs} />

      {children}
    </div>
  );
}
