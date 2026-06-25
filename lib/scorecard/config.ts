import { getConfig } from "@/lib/config";
import type { MetricConfig } from "@/lib/validations/config";

export type ScorecardConfig = {
  metrics: MetricConfig[];
  standardHoursPerDay: number;
};

/** Loads every Config-driven value the Productivity/Staff Scorecard feature depends on, resolved for this org. */
export async function loadScorecardConfig(organisationId: string): Promise<ScorecardConfig> {
  const [metrics, standardHoursPerDay] = await Promise.all([
    getConfig<MetricConfig[]>("scorecard.metrics", organisationId),
    getConfig<number>("productivity.standardHoursPerDay", organisationId),
  ]);
  return { metrics, standardHoursPerDay };
}
