import { AiSettingsTable } from "@/components/admin/ai-settings/ai-settings-table";
import { AiUsageTable } from "@/components/admin/ai-settings/ai-usage-table";

export default function SuperAdminAiDefaultsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">AI Defaults</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The platform-wide GLOBAL setting every org falls back to when it has no ORG/FEATURE override.
          </p>
        </div>
        <AiSettingsTable
          apiBase="/api/super-admin/ai-defaults"
          queryKey={["super-admin", "ai-defaults"]}
          lockScope="GLOBAL"
        />
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Usage — all organisations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Every AI call across every tenant.</p>
        </div>
        <AiUsageTable apiBase="/api/super-admin/ai-usage" showOrgColumn />
      </div>
    </div>
  );
}
