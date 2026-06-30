import { startOfIsoWeek, weekKey } from "@/lib/dates";

export type ActivityForMilestone = {
  id: string;
  name: string;
  endDate: Date;
  isMilestone: boolean;
  milestoneType: string | null;
};

export type DerivedMilestone = {
  name: string;
  date: Date;
  milestoneType: string | null;
  sourceActivityId: string;
};

/** One milestone per activity flagged isMilestone, dated to that activity's end. Re-derived on every program edit. */
export function deriveMilestones(activities: ActivityForMilestone[]): DerivedMilestone[] {
  return activities
    .filter((a) => a.isMilestone)
    .map((a) => ({
      name: a.milestoneType ? `${a.milestoneType}: ${a.name}` : a.name,
      date: a.endDate,
      milestoneType: a.milestoneType,
      sourceActivityId: a.id,
    }));
}

/** Milestones landing in the [from, from + days] window, soonest first — feeds the dashboard's critical-dates view. */
export function filterUpcomingMilestones<T extends { date: Date }>(milestones: T[], from: Date, days = 30): T[] {
  const to = new Date(from.getTime() + days * 86_400_000);
  return milestones
    .filter((m) => m.date >= from && m.date <= to)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type ActivityForDemand = {
  id: string;
  parentId: string | null;
  startDate: Date;
  endDate: Date;
  labourRequired: Record<string, number>;
};

/**
 * Sums each LEAF activity's per-role weekly headcount (labourRequired) across
 * every week it spans, producing the secured labour demand per role per week
 * that the Phase 5 forecast engine consumes. Parent/phase rows in the
 * Scheduling & Gantt task hierarchy are excluded from the sum — their
 * labourRequired is not meaningful (crew need lives on the leaf tasks), so
 * including them would double-count against their children.
 */
export function aggregateLabourDemand(activities: ActivityForDemand[]): Record<string, Record<string, number>> {
  const parentIds = new Set(activities.map((a) => a.parentId).filter((id): id is string => id !== null));
  const leaves = activities.filter((a) => !parentIds.has(a.id));

  const demand: Record<string, Record<string, number>> = {};

  for (const activity of leaves) {
    let cursor = startOfIsoWeek(activity.startDate);
    while (cursor <= activity.endDate) {
      const key = weekKey(cursor);
      const week = (demand[key] ??= {});
      for (const [role, count] of Object.entries(activity.labourRequired)) {
        week[role] = (week[role] ?? 0) + count;
      }
      cursor = new Date(cursor.getTime() + 7 * 86_400_000);
    }
  }

  return demand;
}

export type AllocationForRollup = { weekStart: Date; trade: string };

/**
 * Sums allocated headcount per trade per week — the "allocated" half of the
 * Resource Planner's allocated-vs-required grid, in the same week-bucketed
 * shape aggregateLabourDemand produces for "required" so both can share one
 * blocks/weeks axis. Trade is read live from worker.capability by the caller
 * rather than snapshotted on Allocation.
 */
export function aggregateAllocatedByTrade(allocations: AllocationForRollup[]): Record<string, Record<string, number>> {
  const allocated: Record<string, Record<string, number>> = {};

  for (const allocation of allocations) {
    const key = weekKey(allocation.weekStart);
    const week = (allocated[key] ??= {});
    week[allocation.trade] = (week[allocation.trade] ?? 0) + 1;
  }

  return allocated;
}
