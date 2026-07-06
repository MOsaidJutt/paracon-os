import type { TenantContext } from "@/lib/tenant";
import type { CascadeChange } from "./recalc";
import { findCrossProjectImpact, type CrossProjectImpactEntry } from "./cross-project-impact";

type ActivityForTrade = { id: string; trade: string };

/**
 * DB-aware wrapper around findCrossProjectImpact: pulls every Allocation
 * whose week falls anywhere in the affected range (across ALL projects in
 * the org, not just this one — that's the whole point of a cross-project
 * check) and hands the pure matcher plain data to reason over.
 */
export async function computeCrossProjectImpact(
  db: TenantContext,
  projectId: string,
  activities: ActivityForTrade[],
  changes: CascadeChange[]
): Promise<CrossProjectImpactEntry[]> {
  if (changes.length === 0) return [];

  const tradeById = new Map(activities.map((a) => [a.id, a.trade]));
  const changesForImpact = changes
    .map((c) => ({ ...c, activityId: c.activityId, trade: tradeById.get(c.activityId) ?? "" }))
    .filter((c) => c.trade);
  if (changesForImpact.length === 0) return [];

  const allDates = changesForImpact.flatMap((c) => [c.previousStartDate, c.previousEndDate, c.newStartDate, c.newEndDate]);
  const rangeStart = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const rangeEnd = new Date(Math.max(...allDates.map((d) => d.getTime())));

  const allocations = await db.allocation.findMany({
    where: { weekStart: { gte: rangeStart, lte: rangeEnd } },
    select: {
      workerId: true,
      projectId: true,
      weekStart: true,
      worker: { select: { name: true, capability: true } },
      project: { select: { name: true } },
    },
  });

  return findCrossProjectImpact(
    projectId,
    changesForImpact,
    allocations.map((a) => ({
      workerId: a.workerId,
      workerName: a.worker.name,
      capability: a.worker.capability,
      projectId: a.projectId,
      projectName: a.project.name,
      weekStart: a.weekStart,
    }))
  );
}
