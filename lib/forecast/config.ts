import { getConfig } from "@/lib/config";

export type RagThresholds = { green: number; amber: number; red: number };

export type ForecastConfig = {
  ragThresholds: RagThresholds;
  blockLengthDays: number;
  weeksOut: number;
  heatmapWeeks: number;
};

/** Loads every Config-driven number/weight the Forecast & Capacity engine depends on, resolved for this org. */
export async function loadForecastConfig(organisationId: string): Promise<ForecastConfig> {
  const [ragThresholds, blockLengthDays, weeksOut, heatmapWeeks] = await Promise.all([
    getConfig<RagThresholds>("forecast.ragThresholds", organisationId),
    getConfig<number>("forecast.blockLengthDays", organisationId),
    getConfig<number>("forecast.weeksOut", organisationId),
    getConfig<number>("forecast.heatmapWeeks", organisationId),
  ]);
  return { ragThresholds, blockLengthDays, weeksOut, heatmapWeeks };
}
