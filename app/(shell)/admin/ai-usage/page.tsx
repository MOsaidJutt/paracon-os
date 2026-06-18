import { AiUsageTable } from "@/components/admin/ai-settings/ai-usage-table";

export default function AdminAiUsagePage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Every AI call made on behalf of your organisation — cost, latency and success, regardless
        of whether it resolved to a FEATURE, ORG or the platform GLOBAL setting.
      </p>
      <AiUsageTable apiBase="/api/admin/ai-usage" />
    </div>
  );
}
