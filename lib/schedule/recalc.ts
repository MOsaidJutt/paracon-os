import { DAY_MS, topologicalOrder, type ScheduleDependency, type ScheduleTask } from "./graph";

export type CascadeChange = {
  activityId: string;
  previousStartDate: Date;
  previousEndDate: Date;
  newStartDate: Date;
  newEndDate: Date;
};

export type MoveResult = {
  changes: CascadeChange[];
  requiresReason: boolean;
};

export type DownstreamImpactedEntry = CascadeChange & { name: string };

/** Snapshots every cascaded change except the directly-moved task itself — the DelayRecord's downstream-impact evidence. */
export function toDownstreamImpacted(
  changes: CascadeChange[],
  movedTaskId: string,
  nameById: Map<string, string>
): DownstreamImpactedEntry[] {
  return changes.filter((c) => c.activityId !== movedTaskId).map((c) => ({ ...c, name: nameById.get(c.activityId) ?? "" }));
}

/**
 * Dependencies are treated as MINIMUM constraints, not rigid bindings:
 * dragging a task LATER (or shrinking a gap) only cascades forward to a
 * successor if the move would violate that successor's dependency
 * constraint, in which case the successor is shifted forward by exactly
 * enough to satisfy it (preserving its own duration) and the cascade
 * continues from there. Dragging a task EARLIER never pulls successors
 * earlier — it just opens up a bigger gap, which is the "lead" Buildpass's
 * screenshot 4 describes being recalculated automatically. Every entry this
 * produces is therefore a task moving to a LATER date than it was
 * previously at — `requiresReason` is true whenever there's at least one
 * such entry, driving the delay-reason prompt (FEEDBACK_NOTES §3 / screenshot 1).
 */
export function computeMove(
  tasks: ScheduleTask[],
  dependencies: ScheduleDependency[],
  movedTaskId: string,
  newStart: Date,
  newEnd: Date
): MoveResult {
  const taskIds = tasks.map((t) => t.id);
  const order = topologicalOrder(taskIds, dependencies);

  const current = new Map(tasks.map((t) => [t.id, { start: t.startDate, end: t.endDate }]));
  if (!current.has(movedTaskId)) {
    throw new Error(`Task "${movedTaskId}" is not part of the supplied task list`);
  }
  current.set(movedTaskId, { start: newStart, end: newEnd });

  const outgoingByPredecessor = new Map<string, ScheduleDependency[]>();
  for (const id of taskIds) outgoingByPredecessor.set(id, []);
  for (const dep of dependencies) {
    if (!outgoingByPredecessor.has(dep.predecessorId)) continue;
    outgoingByPredecessor.get(dep.predecessorId)!.push(dep);
  }

  const startIndex = order.indexOf(movedTaskId);
  for (let i = startIndex; i < order.length; i++) {
    const predId = order[i];
    const predDates = current.get(predId)!;

    for (const dep of outgoingByPredecessor.get(predId) ?? []) {
      const succDates = current.get(dep.successorId)!;
      const duration = succDates.end.getTime() - succDates.start.getTime();
      const lagMs = dep.lagDays * DAY_MS;

      let requiredStart: number | null = null;
      let requiredEnd: number | null = null;
      switch (dep.type) {
        case "FINISH_TO_START":
          requiredStart = predDates.end.getTime() + lagMs;
          break;
        case "START_TO_START":
          requiredStart = predDates.start.getTime() + lagMs;
          break;
        case "FINISH_TO_FINISH":
          requiredEnd = predDates.end.getTime() + lagMs;
          break;
        case "START_TO_FINISH":
          requiredEnd = predDates.start.getTime() + lagMs;
          break;
      }

      let nextStart = succDates.start;
      let nextEnd = succDates.end;
      if (requiredStart !== null && requiredStart > succDates.start.getTime()) {
        nextStart = new Date(requiredStart);
        nextEnd = new Date(requiredStart + duration);
      } else if (requiredEnd !== null && requiredEnd > succDates.end.getTime()) {
        nextEnd = new Date(requiredEnd);
        nextStart = new Date(requiredEnd - duration);
      }

      if (nextStart.getTime() !== succDates.start.getTime() || nextEnd.getTime() !== succDates.end.getTime()) {
        current.set(dep.successorId, { start: nextStart, end: nextEnd });
      }
    }
  }

  const changes: CascadeChange[] = [];
  for (const task of tasks) {
    const next = current.get(task.id)!;
    if (next.start.getTime() !== task.startDate.getTime() || next.end.getTime() !== task.endDate.getTime()) {
      changes.push({
        activityId: task.id,
        previousStartDate: task.startDate,
        previousEndDate: task.endDate,
        newStartDate: next.start,
        newEndDate: next.end,
      });
    }
  }

  const requiresReason = changes.some(
    (c) =>
      c.newEndDate.getTime() > c.previousEndDate.getTime() || c.newStartDate.getTime() > c.previousStartDate.getTime()
  );

  return { changes, requiresReason };
}
