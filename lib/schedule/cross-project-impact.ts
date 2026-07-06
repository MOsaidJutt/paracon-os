import { startOfIsoWeek, addDays } from "@/lib/dates";

export type CrossProjectImpactEntry = {
  workerId: string;
  workerName: string;
  otherProjectId: string;
  otherProjectName: string;
  conflictWeeks: string[];
};

export type CascadedActivityForImpact = {
  activityId: string;
  trade: string;
  previousStartDate: Date;
  previousEndDate: Date;
  newStartDate: Date;
  newEndDate: Date;
};

export type AllocationForImpact = {
  workerId: string;
  workerName: string;
  capability: string;
  projectId: string;
  projectName: string;
  weekStart: Date;
};

/** Every ISO-week Monday from `start`'s week through `end`'s week, inclusive. */
export function weeksInRange(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  let cursor = startOfIsoWeek(start);
  const last = startOfIsoWeek(end);
  while (cursor.getTime() <= last.getTime()) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/**
 * The "snowball" check: a crew held on Project A can't start Project B on
 * schedule. For each cascaded activity, finds the workers who actually hold
 * that trade and were already allocated to THIS project during the task's
 * ORIGINAL week range, then checks whether those same workers are ALSO
 * allocated to a DIFFERENT project during the task's NEW (shifted) week
 * range — i.e. this project now needs them during weeks they're already
 * committed elsewhere. Entries are grouped by worker + other project so one
 * entry lists every conflicting week together, rather than one row per week.
 */
export function findCrossProjectImpact(
  thisProjectId: string,
  changes: CascadedActivityForImpact[],
  allAllocations: AllocationForImpact[]
): CrossProjectImpactEntry[] {
  const byWorker = new Map<string, AllocationForImpact[]>();
  for (const allocation of allAllocations) {
    if (!byWorker.has(allocation.workerId)) byWorker.set(allocation.workerId, []);
    byWorker.get(allocation.workerId)!.push(allocation);
  }

  const conflicts = new Map<string, CrossProjectImpactEntry>();

  for (const change of changes) {
    if (!change.trade) continue;
    const originalWeeks = new Set(weeksInRange(change.previousStartDate, change.previousEndDate).map((d) => d.getTime()));
    const newWeeks = weeksInRange(change.newStartDate, change.newEndDate);

    const holders = allAllocations.filter(
      (a) => a.projectId === thisProjectId && a.capability === change.trade && originalWeeks.has(a.weekStart.getTime())
    );

    for (const holder of holders) {
      const otherAllocations = (byWorker.get(holder.workerId) ?? []).filter((a) => a.projectId !== thisProjectId);
      for (const week of newWeeks) {
        const clash = otherAllocations.find((a) => a.weekStart.getTime() === week.getTime());
        if (!clash) continue;

        const key = `${holder.workerId}:${clash.projectId}`;
        const weekStr = week.toISOString().slice(0, 10);
        const existing = conflicts.get(key);
        if (existing) {
          if (!existing.conflictWeeks.includes(weekStr)) existing.conflictWeeks.push(weekStr);
        } else {
          conflicts.set(key, {
            workerId: holder.workerId,
            workerName: holder.workerName,
            otherProjectId: clash.projectId,
            otherProjectName: clash.projectName,
            conflictWeeks: [weekStr],
          });
        }
      }
    }
  }

  return Array.from(conflicts.values());
}
