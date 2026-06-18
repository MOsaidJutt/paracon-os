import { OrganisationsTable } from "@/components/super-admin/organisations-table";

export default function SuperAdminOrganisationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Organisations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every tenant on the platform. Create new ones, suspend, or manage modules and AI.
        </p>
      </div>
      <OrganisationsTable />
    </div>
  );
}
