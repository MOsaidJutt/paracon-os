import { getConfig } from "@/lib/config";
import { checklistItemsSchema, type ChecklistItem } from "./checklist";

export type SimpleDashboardConfig = {
  revenueTargetAud: number;
  kpiGoodThreshold: number;
  kpiWarningThreshold: number;
  checklistItems: ChecklistItem[];
};

/**
 * Every Config-driven value the simplified dashboard reads, resolved for this
 * org in one round of parallel lookups. Nothing here is a code constant: the
 * revenue target, both RAG thresholds and the checklist itself are all edited
 * from the admin settings registry.
 */
export async function loadSimpleDashboardConfig(organisationId: string): Promise<SimpleDashboardConfig> {
  const [revenueTargetAud, kpiGoodThreshold, kpiWarningThreshold, checklistRaw] = await Promise.all([
    getConfig<number>("dashboard.simple.revenueTargetAud", organisationId),
    getConfig<number>("dashboard.simple.kpiGoodThreshold", organisationId),
    getConfig<number>("dashboard.simple.kpiWarningThreshold", organisationId),
    getConfig<unknown>("dashboard.checklist.items", organisationId),
  ]);

  // A malformed checklist row is a settings problem, not a reason to fail the
  // whole dashboard render — drop what doesn't parse and show the rest.
  const parsed = checklistItemsSchema.safeParse(checklistRaw);

  return {
    revenueTargetAud,
    kpiGoodThreshold,
    kpiWarningThreshold,
    checklistItems: parsed.success ? parsed.data : [],
  };
}
