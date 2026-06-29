import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/admin-tabs";

const TABS = [
  { href: "/contacts/clients", label: "Clients", permission: "tender.view" },
  { href: "/contacts/suppliers", label: "Suppliers", permission: "tender.view" },
  { href: "/contacts/workers", label: "Workers", permission: "labour.view" },
];

export default async function ContactsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const visibleTabs = TABS.filter((t) => session.user.permissions.includes(t.permission));
  if (visibleTabs.length === 0) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Contacts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clients, suppliers and workers in one place — every module looks up contacts from here.
        </p>
      </div>

      <AdminTabs tabs={visibleTabs} />

      {children}
    </div>
  );
}
