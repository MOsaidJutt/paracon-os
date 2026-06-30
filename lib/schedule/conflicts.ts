import { aggregateLabourDemand, type ActivityForDemand } from "@/lib/projects/calculations";
import type { WeeklyMap } from "@/lib/forecast/engine";

export type ProjectActivities = {
  projectName: string;
  activities: ActivityForDemand[];
};

export type TradeConflict = {
  week: string;
  trade: string;
  demand: number;
  supply: number;
  gap: number;
  projects: { projectId: string; projectName: string; demand: number }[];
};

/**
 * Surfaces the real equivalent of Buildpass's "same worker double-booked
 * across schedules" conflict, reinterpreted for OneParacon's data model:
 * `Allocation` already enforces one worker = one project per ISO week at the
 * DB level (its unique constraint), so a literal per-worker double-booking
 * can't happen here. What CAN happen — and is just as real a scheduling risk
 * — is two or more active projects competing for the same trade in the same
 * week, with combined demand exceeding org-wide supply. A "conflict" is only
 * raised when at least two distinct projects contribute demand for that
 * trade/week AND the combined demand exceeds supply; a single project's own
 * shortfall is an ordinary forecast shortage already surfaced elsewhere
 * (Forecast & Resource Planner), not a cross-project conflict.
 */
export function findTradeConflicts(activitiesByProject: Map<string, ProjectActivities>, supply: WeeklyMap): TradeConflict[] {
  const contributors = new Map<string, Map<string, { projectName: string; demand: number }>>();
  const combined: WeeklyMap = {};

  for (const [projectId, { projectName, activities }] of activitiesByProject) {
    const demand = aggregateLabourDemand(activities);
    for (const [week, roles] of Object.entries(demand)) {
      for (const [trade, count] of Object.entries(roles)) {
        if (count <= 0) continue;

        const bucket = (combined[week] ??= {});
        bucket[trade] = (bucket[trade] ?? 0) + count;

        const key = `${week}::${trade}`;
        const byProject = contributors.get(key) ?? new Map<string, { projectName: string; demand: number }>();
        byProject.set(projectId, { projectName, demand: count });
        contributors.set(key, byProject);
      }
    }
  }

  const conflicts: TradeConflict[] = [];
  for (const [week, roles] of Object.entries(combined)) {
    for (const [trade, demand] of Object.entries(roles)) {
      const byProject = contributors.get(`${week}::${trade}`)!;
      if (byProject.size < 2) continue;

      const weekSupply = supply[week]?.[trade] ?? 0;
      const gap = demand - weekSupply;
      if (gap <= 0) continue;

      conflicts.push({
        week,
        trade,
        demand,
        supply: weekSupply,
        gap,
        projects: Array.from(byProject.entries()).map(([projectId, v]) => ({ projectId, ...v })),
      });
    }
  }

  return conflicts.sort((a, b) => (a.week === b.week ? b.gap - a.gap : a.week.localeCompare(b.week)));
}
