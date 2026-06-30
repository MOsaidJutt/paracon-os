import { DAY_MS, topologicalOrder, type ScheduleDependency, type ScheduleTask } from "./graph";

export type CriticalPathEntry = {
  isCritical: boolean;
  floatDays: number;
  earlyStart: Date;
  earlyFinish: Date;
  lateStart: Date;
  lateFinish: Date;
};

/**
 * Computes total float against the schedule's ACTUAL current dates — not a
 * textbook CPM forward pass that recomputes "earliest possible" dates from
 * durations alone. ES/EF are simply each task's real startDate/endDate, so a
 * gap a PM has deliberately left between two linked tasks shows up as real
 * float on the predecessor, rather than being discarded. Only the backward
 * pass is computed: a task's late finish is bounded by its successors' late
 * dates via the dependency formula (generalised to all 4 types + lag/lead);
 * a sink task's late finish is the project's actual current end date. A task
 * is critical when its total float is <= 0 — zero is the textbook case;
 * negative means its current dates already violate a dependency constraint,
 * worth flagging as critical (or worse) rather than silently "fine".
 */
export function computeCriticalPath(
  tasks: ScheduleTask[],
  dependencies: ScheduleDependency[]
): Map<string, CriticalPathEntry> {
  if (tasks.length === 0) return new Map();

  const taskIds = tasks.map((t) => t.id);
  const order = topologicalOrder(taskIds, dependencies);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const outgoing = new Map<string, ScheduleDependency[]>();
  for (const id of taskIds) outgoing.set(id, []);
  for (const dep of dependencies) {
    if (!outgoing.has(dep.predecessorId) || !taskIds.includes(dep.successorId)) continue;
    outgoing.get(dep.predecessorId)!.push(dep);
  }

  const earlyStart = new Map(taskIds.map((id) => [id, byId.get(id)!.startDate.getTime()]));
  const earlyFinish = new Map(taskIds.map((id) => [id, byId.get(id)!.endDate.getTime()]));
  const projectEnd = Math.max(...Array.from(earlyFinish.values()));

  const lateStart = new Map<string, number>();
  const lateFinish = new Map<string, number>();

  for (const id of [...order].reverse()) {
    const outgoingDeps = outgoing.get(id)!;
    const dur = earlyFinish.get(id)! - earlyStart.get(id)!;
    // The global project end is always a valid ceiling for every task, not
    // just literal sinks — a non-sink predecessor can still have a later
    // ACTUAL finish than its successor chain requires (e.g. its own outgoing
    // constraint is looser than how the rest of the project actually plays
    // out), in which case the project's real end is being driven by that
    // task directly rather than by anything downstream of it.
    const lf = Math.min(projectEnd, ...outgoingDeps.map((dep) => backwardConstraint(dep, lateStart, lateFinish, dur)));
    lateFinish.set(id, lf);
    lateStart.set(id, lf - dur);
  }

  const result = new Map<string, CriticalPathEntry>();
  for (const id of taskIds) {
    const es = earlyStart.get(id)!;
    const ls = lateStart.get(id)!;
    const floatDays = Math.round((ls - es) / DAY_MS);
    result.set(id, {
      isCritical: floatDays <= 0,
      floatDays,
      earlyStart: new Date(es),
      earlyFinish: new Date(earlyFinish.get(id)!),
      lateStart: new Date(ls),
      lateFinish: new Date(lateFinish.get(id)!),
    });
  }
  return result;
}

function backwardConstraint(
  dep: ScheduleDependency,
  lateStart: Map<string, number>,
  lateFinish: Map<string, number>,
  predecessorDuration: number
): number {
  const succLS = lateStart.get(dep.successorId)!;
  const succLF = lateFinish.get(dep.successorId)!;
  const lagMs = dep.lagDays * DAY_MS;
  switch (dep.type) {
    case "FINISH_TO_START":
      return succLS - lagMs;
    case "START_TO_START":
      return succLS - lagMs + predecessorDuration;
    case "FINISH_TO_FINISH":
      return succLF - lagMs;
    case "START_TO_FINISH":
      return succLF - lagMs + predecessorDuration;
  }
}
