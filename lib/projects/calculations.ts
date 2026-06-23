import { startOfIsoWeek, weekKey } from "@/lib/dates";

export type ActivityForMilestone = {
  id: string;
  name: string;
  endDate: Date;
  isCritical: boolean;
  milestoneType: string | null;
};

export type DerivedMilestone = {
  name: string;
  date: Date;
  milestoneType: string | null;
  sourceActivityId: string;
};

/** One milestone per critical activity, dated to that activity's end. Re-derived on every program edit. */
export function deriveMilestones(activities: ActivityForMilestone[]): DerivedMilestone[] {
  return activities
    .filter((a) => a.isCritical)
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
  startDate: Date;
  endDate: Date;
  labourRequired: Record<string, number>;
};

/**
 * Sums each activity's per-role weekly headcount (labourRequired) across every
 * week it spans, producing the secured labour demand per role per week that
 * the Phase 5 forecast engine consumes.
 */
export function aggregateLabourDemand(activities: ActivityForDemand[]): Record<string, Record<string, number>> {
  const demand: Record<string, Record<string, number>> = {};

  for (const activity of activities) {
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
