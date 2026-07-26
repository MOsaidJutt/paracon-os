import { auth } from "@/lib/auth";
import { ProspectsView } from "@/components/prospects/prospects-view";

export default async function ProspectsPage() {
  const session = await auth();
  const canEdit = session?.user?.permissions?.includes("prospect.edit") ?? false;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Prospects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads before they&apos;re worth running a tender — cold to warm. Convert one and its client, contact,
          address and estimate carry straight over.
        </p>
      </div>
      <ProspectsView canEdit={canEdit} />
    </div>
  );
}
