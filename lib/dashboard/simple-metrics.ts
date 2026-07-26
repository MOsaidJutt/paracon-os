import type { MatrixCell } from "@/lib/forecast/engine";
import type { ProjectHealthStatus } from "./health";

/**
 * The pure percentage maths behind the simplified dashboard's rings and bars.
 * Kept free of Prisma and of the request so every one of these is directly
 * unit-testable, and so the "where does this number come from?" copy shown in
 * each ring's detail panel has exactly one implementation to describe.
 *
 * Every function returns `null` for "no signal yet" rather than 0. A brand-new
 * org with no tenders has an UNKNOWN win rate, not a 0% one, and showing a red
 * zero would be a lie the user then has to disprove.
 */
export type Percent = number | null;

function ratioToPercent(numerator: number, denominator: number): Percent {
  if (denominator <= 0) return null;
  return Math.max(0, (numerator / denominator) * 100);
}

/** Revenue won against the org's configured target. Can exceed 100%: beating the target is not an error. */
export function revenueWonPercent(revenueWon: number, targetAud: number): Percent {
  return ratioToPercent(revenueWon, targetAud);
}

/** A 0-1 rate from the tender calculations, as a percentage. */
export function ratePercent(rate: number | null | undefined, hasSignal: boolean): Percent {
  if (!hasSignal || rate === null || rate === undefined) return null;
  return Math.max(0, Math.min(100, rate * 100));
}

/**
 * Committed labour against available labour for the current forecast block,
 * in worker-weeks. Capped at 100 — demand beyond supply is a shortage, which
 * the capacity card and the alerts both already say out loud, and a ring
 * showing 140% "utilised" would read as a good number.
 */
export function labourUtilisationPercent(matrix: MatrixCell[]): Percent {
  const currentBlock = matrix.filter((cell) => cell.blockIndex === 0);
  const supply = currentBlock.reduce((sum, cell) => sum + cell.supply, 0);
  const demand = currentBlock.reduce((sum, cell) => sum + cell.demand, 0);
  if (supply <= 0) return null;
  return Math.min(100, (demand / supply) * 100);
}

export function projectsOnTrackPercent(statuses: ProjectHealthStatus[]): Percent {
  return ratioToPercent(statuses.filter((s) => s === "On Track").length, statuses.length);
}

export function complianceCurrentPercent(statuses: string[]): Percent {
  return ratioToPercent(statuses.filter((s) => s === "Valid").length, statuses.length);
}

/**
 * Attendance across every productivity record in the period: days actually
 * worked over days rostered.
 */
export function attendancePercent(records: { attendanceDays: number; expectedDays: number }[]): Percent {
  const expected = records.reduce((sum, r) => sum + r.expectedDays, 0);
  const attended = records.reduce((sum, r) => sum + r.attendanceDays, 0);
  return ratioToPercent(attended, expected);
}

/**
 * Planned hours over actual hours, capped at 100 — a crew that took MORE
 * hours than planned is less productive, so the ratio is deliberately the
 * inverse of ProductivityRecord.outputRatio (which is actual/planned, where
 * 1.0 is on plan and higher is worse). Expressed this way, 100% means
 * "delivered in the hours we planned or fewer", which is the direction every
 * other bar on this dashboard reads.
 */
export function labourEfficiencyPercent(records: { plannedHours: number; actualHours: number }[]): Percent {
  const planned = records.reduce((sum, r) => sum + r.plannedHours, 0);
  const actual = records.reduce((sum, r) => sum + r.actualHours, 0);
  if (actual <= 0) return null;
  return Math.min(100, (planned / actual) * 100);
}

/** Mean of a set of already-0-100 staff scores. */
export function averageScore(scores: number[]): Percent {
  if (scores.length === 0) return null;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Per-trade utilisation for the "Can we take on more work?" bars, paired with
 * that trade's worst-case headroom so the bar can be banded by whether the
 * trade is actually short rather than by how busy it looks.
 */
export type TradeUtilisation = {
  role: string;
  utilisationPercent: number;
  headroom: number;
  demand: number;
  supply: number;
};

export function tradeUtilisation(
  matrix: MatrixCell[],
  headroomByRole: { role: string; headroom: number }[]
): TradeUtilisation[] {
  const headroomLookup = new Map(headroomByRole.map((r) => [r.role, r.headroom]));

  return headroomByRole.map(({ role }) => {
    const cells = matrix.filter((cell) => cell.role === role && cell.blockIndex === 0);
    const demand = cells.reduce((sum, cell) => sum + cell.demand, 0);
    const supply = cells.reduce((sum, cell) => sum + cell.supply, 0);
    return {
      role,
      utilisationPercent: supply > 0 ? Math.min(100, (demand / supply) * 100) : 0,
      headroom: headroomLookup.get(role) ?? 0,
      demand,
      supply,
    };
  });
}
