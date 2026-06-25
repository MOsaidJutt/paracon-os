import { round2 } from "@/lib/documents/money";

/** Actual hours worked vs planned hours for a trade in a period — 1.0 means exactly on plan. Null when there was nothing planned (avoids a divide-by-zero reading as "infinite productivity"). */
export function calcOutputRatio(plannedHours: number, actualHours: number): number | null {
  if (plannedHours <= 0) return null;
  return round2(actualHours / plannedHours);
}

/** Attendance rate for a worker/trade in a period. Null when nobody was ever rostered (no signal yet), not 0 (which would read as "always absent"). */
export function calcReliabilityPct(presentDays: number, expectedDays: number): number | null {
  if (expectedDays <= 0) return null;
  return round2(Math.min(1, Math.max(0, presentDays / expectedDays)));
}

/**
 * Each trade's share of a project's TOTAL planned hours in a period — the
 * allocation key the $/unit proxy uses to split Project.value across trades
 * (see ProductivityRecord's schema comment: Project.tradePackages and
 * Worker.capability are different vocabularies, so this proxy uses the
 * planned-labour mix instead of a real trade-package mapping).
 */
export function allocatePlannedHoursShare(plannedHoursByTrade: Record<string, number>): Record<string, number> {
  const total = Object.values(plannedHoursByTrade).reduce((sum, h) => sum + h, 0);
  if (total <= 0) return Object.fromEntries(Object.keys(plannedHoursByTrade).map((trade) => [trade, 0]));

  return Object.fromEntries(
    Object.entries(plannedHoursByTrade).map(([trade, hours]) => [trade, round2(hours / total)])
  );
}

/**
 * Approximate $/labour-hour for a trade: the project's contract value
 * allocated by that trade's planned-hours share, divided by hours actually
 * worked. A benchmark for estimating, not a literal $/m² rate.
 */
export function calcCostPerHour(projectValue: number, plannedHoursShare: number, actualHours: number): number | null {
  if (actualHours <= 0 || plannedHoursShare <= 0) return null;
  return round2((projectValue * plannedHoursShare) / actualHours);
}

/** Maps a 0-1+ ratio (1.0 = on target) onto a metric's 0..scaleMax scale, capped at scaleMax. No data (null) scores 0 rather than assuming a default. */
export function scaleRatioToScore(ratio: number | null, scaleMax: number): number {
  if (ratio === null) return 0;
  return round2(Math.min(scaleMax, Math.max(0, ratio * scaleMax)));
}
