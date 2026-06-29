import { ProspectsTable } from "@/components/prospects/prospects-table";

export default function ProspectsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Prospects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads before they&apos;re worth running a tender — cold to warm. Convert a warm lead and its
          contact details carry straight over to a new tender.
        </p>
      </div>
      <ProspectsTable />
    </div>
  );
}
