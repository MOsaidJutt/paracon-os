import { addDays, startOfIsoWeek, weekKey, weekSequence } from "@/lib/dates";
import type { RagThresholds } from "@/lib/forecast/config";

/** weekKey (Monday, ISO date) -> role -> headcount. The shared unit every demand/supply source produces. */
export type WeeklyMap = Record<string, Record<string, number>>;

function addToWeek(map: WeeklyMap, week: string, role: string, amount: number): void {
  if (amount === 0) return;
  const bucket = (map[week] ??= {});
  bucket[role] = (bucket[role] ?? 0) + amount;
}

/** Sums any number of weekly role-count maps (e.g. secured + pipeline demand) into one. */
export function mergeWeeklyMaps(...maps: WeeklyMap[]): WeeklyMap {
  const merged: WeeklyMap = {};
  for (const map of maps) {
    for (const [week, roles] of Object.entries(map)) {
      for (const [role, count] of Object.entries(roles)) {
        addToWeek(merged, week, role, count);
      }
    }
  }
  return merged;
}

export type PipelineTenderForDemand = {
  expectedStart: Date | null;
  expectedEnd: Date | null;
  expectedLabour: Record<string, number> | null;
  winProbabilityNumeric: number;
};

/**
 * Pipeline demand, weighted by win probability: a tender needing 2 carpenters
 * with a 50% win probability contributes 1 carpenter-equivalent per week of
 * its expected build window. Only tenders with expectedStart/expectedEnd/
 * expectedLabour all set contribute — those fields are populated manually by
 * an estimator, so an unscoped tender simply contributes nothing yet.
 */
export function aggregateWeightedPipelineDemand(tenders: PipelineTenderForDemand[]): WeeklyMap {
  const demand: WeeklyMap = {};

  for (const tender of tenders) {
    if (!tender.expectedStart || !tender.expectedEnd || !tender.expectedLabour) continue;

    let cursor = startOfIsoWeek(tender.expectedStart);
    while (cursor <= tender.expectedEnd) {
      const week = weekKey(cursor);
      for (const [role, count] of Object.entries(tender.expectedLabour)) {
        addToWeek(demand, week, role, count * tender.winProbabilityNumeric);
      }
      cursor = addDays(cursor, 7);
    }
  }

  return demand;
}

export type WorkerForSupply = {
  capability: string;
  status: string;
  leave: { startDate: Date; endDate: Date }[];
};

/**
 * Supply per role per week: workers of that capability who are `availableStatus`
 * (default "Available" — "Assigned"/"On Leave" workers contribute zero supply
 * outright) and have no WorkerLeave row overlapping that week. Date-ranged
 * leave is netted separately from the point-in-time status so a worker who is
 * Available today but has booked leave in week 6 still counts as supply now
 * and drops out only in week 6.
 */
export function computeWeeklySupply(
  workers: WorkerForSupply[],
  weeks: Date[],
  availableStatus = "Available"
): WeeklyMap {
  const supply: WeeklyMap = {};

  for (const weekStart of weeks) {
    const key = weekKey(weekStart);
    const weekEnd = addDays(weekStart, 6);

    for (const worker of workers) {
      if (worker.status !== availableStatus) continue;
      const onLeave = worker.leave.some((l) => l.startDate <= weekEnd && l.endDate >= weekStart);
      if (onLeave) continue;
      addToWeek(supply, key, worker.capability, 1);
    }
  }

  return supply;
}

/** GAP(role, week) = demand - supply, only for weeks present in `weeks`. */
export function computeGap(demand: WeeklyMap, supply: WeeklyMap, roles: string[], weeks: string[]): WeeklyMap {
  const gap: WeeklyMap = {};
  for (const week of weeks) {
    for (const role of roles) {
      const d = demand[week]?.[role] ?? 0;
      const s = supply[week]?.[role] ?? 0;
      addToWeek(gap, week, role, d - s);
    }
  }
  return gap;
}

export type Block = { index: number; label: string; weeks: string[] };

/**
 * Chunks the forecast horizon into fixed-length blocks (default 3 weeks,
 * config-driven). The final block may be shorter than the rest when
 * `weeksOut` isn't an exact multiple of the block length.
 */
export function buildBlocks(from: Date, blockLengthDays: number, weeksOut: number): Block[] {
  const blockWeeks = Math.max(1, Math.round(blockLengthDays / 7));
  const weeks = weekSequence(from, weeksOut).map(weekKey);

  const blocks: Block[] = [];
  for (let i = 0; i < weeks.length; i += blockWeeks) {
    const chunk = weeks.slice(i, i + blockWeeks);
    const startN = i + 1;
    const endN = i + chunk.length;
    blocks.push({
      index: blocks.length,
      label: startN === endN ? `W${startN}` : `W${startN}–${endN}`,
      weeks: chunk,
    });
  }
  return blocks;
}

export type RagStatus = "Covered" | "Watch" | "Short";

/** demand === 0 is always Covered (nothing to staff), regardless of supply. */
export function classifyRag(
  demand: number,
  supply: number,
  thresholds: RagThresholds
): { status: RagStatus; severity: "normal" | "critical" } {
  if (demand <= 0) return { status: "Covered", severity: "normal" };

  const ratio = supply / demand;
  if (ratio >= thresholds.green) return { status: "Covered", severity: "normal" };
  if (ratio >= thresholds.amber) return { status: "Watch", severity: "normal" };
  return { status: "Short", severity: ratio < thresholds.red ? "critical" : "normal" };
}

export type MatrixCell = {
  role: string;
  blockIndex: number;
  blockLabel: string;
  demand: number;
  supply: number;
  gap: number;
  status: RagStatus;
  severity: "normal" | "critical";
};

/** Role x block RAG matrix — the brief's core table. Demand/supply are summed (worker-weeks) across each block's weeks. */
export function buildForecastMatrix(
  weeklyDemand: WeeklyMap,
  weeklySupply: WeeklyMap,
  roles: string[],
  blocks: Block[],
  thresholds: RagThresholds
): MatrixCell[] {
  const cells: MatrixCell[] = [];

  for (const role of roles) {
    for (const block of blocks) {
      let demand = 0;
      let supply = 0;
      for (const week of block.weeks) {
        demand += weeklyDemand[week]?.[role] ?? 0;
        supply += weeklySupply[week]?.[role] ?? 0;
      }
      const { status, severity } = classifyRag(demand, supply, thresholds);
      cells.push({
        role,
        blockIndex: block.index,
        blockLabel: block.label,
        demand,
        supply,
        gap: Math.max(0, demand - supply),
        status,
        severity,
      });
    }
  }

  return cells;
}

export type HeatmapCell = {
  trade: string;
  weekIndex: number;
  week: string;
  demand: number;
  supply: number;
  gap: number;
  status: RagStatus;
  severity: "normal" | "critical";
};

/** Trade x week heatmap (default 8 weeks, config-driven) — the dashboard mockup's at-a-glance view. */
export function buildHeatmap(
  weeklyDemand: WeeklyMap,
  weeklySupply: WeeklyMap,
  roles: string[],
  weeks: string[],
  thresholds: RagThresholds
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];

  for (const role of roles) {
    weeks.forEach((week, weekIndex) => {
      const demand = weeklyDemand[week]?.[role] ?? 0;
      const supply = weeklySupply[week]?.[role] ?? 0;
      const { status, severity } = classifyRag(demand, supply, thresholds);
      cells.push({ trade: role, weekIndex, week, demand, supply, gap: Math.max(0, demand - supply), status, severity });
    });
  }

  return cells;
}

export type RoleHeadroom = { role: string; headroom: number };
export type ShortageEntry = { role: string; blockIndex: number; blockLabel: string; gap: number };
export type CapacityHeadroom = {
  byRole: RoleHeadroom[];
  shortages: ShortageEntry[];
  canTakeOnMoreWork: boolean;
  totalHeadroom: number;
};

/**
 * Headroom per role is the WORST-CASE surplus across the whole horizon (the
 * minimum of supply-demand over every block) — how many more of that trade
 * could be committed to new work today without creating a shortage in any
 * future block. A negative value means the role is already short somewhere.
 */
export function computeHeadroom(matrix: MatrixCell[], roles: string[]): CapacityHeadroom {
  const byRole: RoleHeadroom[] = roles.map((role) => {
    const cells = matrix.filter((c) => c.role === role);
    const headroom = cells.length === 0 ? 0 : Math.min(...cells.map((c) => c.supply - c.demand));
    return { role, headroom };
  });

  const shortages: ShortageEntry[] = matrix
    .filter((c) => c.status === "Short")
    .map((c) => ({ role: c.role, blockIndex: c.blockIndex, blockLabel: c.blockLabel, gap: c.gap }));

  return {
    byRole,
    shortages,
    canTakeOnMoreWork: byRole.every((r) => r.headroom >= 0),
    totalHeadroom: byRole.reduce((sum, r) => sum + Math.max(0, r.headroom), 0),
  };
}
