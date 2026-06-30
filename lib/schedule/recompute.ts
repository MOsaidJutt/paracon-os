import type { TenantContext } from "@/lib/tenant";
import { computeCriticalPath } from "./critical-path";
import type { DependencyType } from "./graph";

/**
 * Re-derives isCritical/floatDays for every activity in a project from the
 * current dependency graph and persists the result. Call after any mutation
 * that could change the critical path: activity create/update/delete,
 * dependency create/update/delete, or a committed task move.
 */
export async function recomputeCriticalPath(db: TenantContext, projectId: string): Promise<void> {
  const [activities, dependencies] = await Promise.all([
    db.programActivity.findMany({ where: { projectId }, select: { id: true, startDate: true, endDate: true } }),
    db.dependency.findMany({
      where: { predecessor: { projectId } },
      select: { predecessorId: true, successorId: true, type: true, lagDays: true },
    }),
  ]);

  if (activities.length === 0) return;

  const result = computeCriticalPath(
    activities,
    dependencies.map((d) => ({
      predecessorId: d.predecessorId,
      successorId: d.successorId,
      type: d.type as DependencyType,
      lagDays: d.lagDays,
    }))
  );

  await db.$transaction(
    activities.map((a) => {
      const entry = result.get(a.id);
      return db.programActivity.update({
        where: { id: a.id },
        data: { isCritical: entry?.isCritical ?? false, floatDays: entry?.floatDays ?? null },
      });
    })
  );
}
