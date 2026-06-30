export type ScheduleTask = {
  id: string;
  startDate: Date;
  endDate: Date;
};

export type DependencyType = "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH" | "START_TO_FINISH";

export type ScheduleDependency = {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
};

export const DAY_MS = 86_400_000;

export class DependencyCycleError extends Error {
  constructor() {
    super("Dependency graph contains a cycle");
    this.name = "DependencyCycleError";
  }
}

/**
 * Kahn's algorithm. Throws DependencyCycleError if the graph can't be fully
 * ordered — the cycle guard used both by critical-path computation and by
 * the dependency-create route (a new edge is rejected before it's persisted
 * if it would introduce a cycle).
 */
export function topologicalOrder(taskIds: string[], dependencies: ScheduleDependency[]): string[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of taskIds) {
    adjacency.set(id, []);
    inDegree.set(id, 0);
  }
  for (const dep of dependencies) {
    if (!adjacency.has(dep.predecessorId) || !inDegree.has(dep.successorId)) continue;
    adjacency.get(dep.predecessorId)!.push(dep.successorId);
    inDegree.set(dep.successorId, (inDegree.get(dep.successorId) ?? 0) + 1);
  }

  const queue = taskIds.filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  if (order.length !== taskIds.length) throw new DependencyCycleError();
  return order;
}

export function durationMs(task: ScheduleTask): number {
  return task.endDate.getTime() - task.startDate.getTime();
}
