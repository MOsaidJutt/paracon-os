import { getConfig } from "@/lib/config";

export type DashboardHealthConfig = {
  attentionMilestoneWindowDays: number;
  criticalIssueSeverities: string[];
  shortageWatchWeeks: number;
};

/** Loads every Config-driven threshold the Director/PM dashboards' project-health derivation depends on, resolved for this org. */
export async function loadDashboardHealthConfig(organisationId: string): Promise<DashboardHealthConfig> {
  const [attentionMilestoneWindowDays, criticalIssueSeverities, shortageWatchWeeks] = await Promise.all([
    getConfig<number>("dashboard.health.attentionMilestoneWindowDays", organisationId),
    getConfig<string[]>("dashboard.health.criticalIssueSeverities", organisationId),
    getConfig<number>("dashboard.health.shortageWatchWeeks", organisationId),
  ]);
  return { attentionMilestoneWindowDays, criticalIssueSeverities, shortageWatchWeeks };
}
