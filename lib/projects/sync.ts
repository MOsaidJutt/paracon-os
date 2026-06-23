import type { TenantContext } from "@/lib/tenant";
import { deriveMilestones } from "./calculations";

/**
 * Re-derives every auto-generated milestone for a project from its current
 * activities. Called after any activity create/update/delete so milestones
 * never drift from the critical-flagged activities that produced them.
 */
export async function syncProjectMilestones(
  db: TenantContext,
  organisationId: string,
  projectId: string
): Promise<void> {
  const activities = await db.programActivity.findMany({ where: { projectId } });
  const derived = deriveMilestones(
    activities.map((a) => ({
      id: a.id,
      name: a.name,
      endDate: a.endDate,
      isCritical: a.isCritical,
      milestoneType: a.milestoneType,
    }))
  );

  await db.milestone.deleteMany({ where: { projectId, sourceActivityId: { not: null } } });
  if (derived.length > 0) {
    await db.milestone.createMany({
      data: derived.map((m) => ({
        organisationId,
        projectId,
        name: m.name,
        date: m.date,
        milestoneType: m.milestoneType,
        sourceActivityId: m.sourceActivityId,
      })),
    });
  }
}
