import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";
import { weekSequence, weekKey } from "@/lib/dates";
import { loadForecastConfig } from "@/lib/forecast/config";
import { aggregateLabourDemand } from "@/lib/projects/calculations";
import { loadTenderConfig } from "@/lib/tenders/config";
import { activeStatusesFromWeights } from "@/lib/tenders/calculations";
import {
  aggregateWeightedPipelineDemand,
  buildBlocks,
  buildForecastMatrix,
  buildHeatmap,
  computeHeadroom,
  computeWeeklySupply,
  mergeWeeklyMaps,
  type CapacityHeadroom,
  type HeatmapCell,
  type MatrixCell,
} from "@/lib/forecast/engine";

export type ForecastResult = {
  generatedAt: string;
  blockLengthDays: number;
  weeksOut: number;
  roles: string[];
  matrix: MatrixCell[];
  heatmap: HeatmapCell[];
  headroom: CapacityHeadroom;
};

/**
 * Runs the full DEMAND/SUPPLY/GAP pipeline for one org against the current
 * database state and returns the result. Pure with respect to its inputs
 * (today's date aside) — all DB reads happen here, all math happens in
 * lib/forecast/engine.ts.
 */
export async function computeForecastResult(organisationId: string, now: Date = new Date()): Promise<ForecastResult> {
  const [forecastConfig, tenderConfig, roles] = await Promise.all([
    loadForecastConfig(organisationId),
    loadTenderConfig(organisationId),
    getConfig<string[]>("trade.capabilityList", organisationId),
  ]);

  // Only tenders still genuinely "in flight" count as pipeline demand. A Won
  // tender's demand has already moved to its converted Project's secured
  // ProgramActivity rows (counting it here too would double-count it); a
  // Lost/Withdrawn tender never materialises. activeStatusesFromWeights
  // (weight strictly between 0 and 1) is the same rule the tender dashboard
  // already uses for "Active Bids" / "Total Pipeline", so this stays
  // consistent with that definition of "active" rather than inventing a
  // second one.
  const activeTenderStatuses = activeStatusesFromWeights(tenderConfig.statusWeights);

  const horizonWeeks = weekSequence(now, forecastConfig.weeksOut);
  const horizonWeekKeys = horizonWeeks.map(weekKey);
  const heatmapWeekKeys = horizonWeekKeys.slice(0, forecastConfig.heatmapWeeks);

  const [activities, tenders, workers] = await Promise.all([
    prisma.programActivity.findMany({
      where: { organisationId, endDate: { gte: now } },
      select: { id: true, parentId: true, startDate: true, endDate: true, labourRequired: true },
    }),
    prisma.tender.findMany({
      where: {
        organisationId,
        status: { in: activeTenderStatuses },
        expectedStart: { not: null },
        expectedEnd: { not: null },
      },
      select: { expectedStart: true, expectedEnd: true, expectedLabour: true, winProbabilityNumeric: true },
    }),
    prisma.worker.findMany({
      where: { organisationId },
      select: { capability: true, status: true, leave: { select: { startDate: true, endDate: true } } },
    }),
  ]);

  const securedDemand = aggregateLabourDemand(
    activities.map((a) => ({ ...a, labourRequired: a.labourRequired as Record<string, number> }))
  );
  const pipelineDemand = aggregateWeightedPipelineDemand(
    tenders.map((t) => ({ ...t, expectedLabour: t.expectedLabour as Record<string, number> | null }))
  );
  const weeklyDemand = mergeWeeklyMaps(securedDemand, pipelineDemand);
  const weeklySupply = computeWeeklySupply(workers, horizonWeeks);

  const blocks = buildBlocks(now, forecastConfig.blockLengthDays, forecastConfig.weeksOut);
  const matrix = buildForecastMatrix(weeklyDemand, weeklySupply, roles, blocks, forecastConfig.ragThresholds);
  const heatmap = buildHeatmap(weeklyDemand, weeklySupply, roles, heatmapWeekKeys, forecastConfig.ragThresholds);
  const headroom = computeHeadroom(matrix, roles);

  return {
    generatedAt: now.toISOString(),
    blockLengthDays: forecastConfig.blockLengthDays,
    weeksOut: forecastConfig.weeksOut,
    roles,
    matrix,
    heatmap,
    headroom,
  };
}

/** Computes the forecast and persists it as this org's ForecastSnapshot (upsert — one row per org). */
export async function recomputeForecastSnapshot(organisationId: string, now: Date = new Date()): Promise<ForecastResult> {
  const result = await computeForecastResult(organisationId, now);

  await prisma.forecastSnapshot.upsert({
    where: { organisationId },
    update: {
      generatedAt: now,
      blockLengthDays: result.blockLengthDays,
      weeksOut: result.weeksOut,
      matrixJson: result.matrix,
      heatmapJson: result.heatmap,
      headroomJson: result.headroom,
    },
    create: {
      organisationId,
      generatedAt: now,
      blockLengthDays: result.blockLengthDays,
      weeksOut: result.weeksOut,
      matrixJson: result.matrix,
      heatmapJson: result.heatmap,
      headroomJson: result.headroom,
    },
  });

  return result;
}
