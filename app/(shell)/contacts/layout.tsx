import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getViewMode } from "@/lib/view-mode";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { DirectoryView } from "@/components/contacts/directory-view";

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

  const viewMode = await getViewMode(session.user.organisationId, session.user.id);

  // Directory is one screen with its own in-page Clients/Suppliers/Workers
  // tabs (DirectoryView), not the three routed pages Full uses — so
  // `children` (whichever /contacts/* page matched) is intentionally not
  // rendered here. Same route tree serves both views; only the chrome and
  // body swap, same as tenders/projects/[id].
  if (viewMode === "SIMPLE") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clients, suppliers, subbies and workers in one place — autocomplete everywhere pulls from here.
          </p>
        </div>
        <DirectoryView />
      </div>
    );
  }

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
