import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ImportCentreWizard } from "@/components/import/import-centre-wizard";

export default async function ImportCentrePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.permissions.includes("import.run")) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Import Centre</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pluggable importers — upload, map columns, preview a dry run, then commit. Every import is tenant-scoped,
          idempotent and logged.
        </p>
      </div>

      <ImportCentreWizard />
    </div>
  );
}
