import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { weekSequence } from "@/lib/dates";
import { computeWeeklySupply } from "@/lib/forecast/engine";
import { findTradeConflicts, type ProjectActivities } from "@/lib/schedule/conflicts";

const DAY_MS = 86_400_000;

/**
 * Cross-project schedule calendar (FEEDBACK_NOTES §3 / Buildpass screenshots
 * 5-7): every active project's activities in the requested window, plus
 * trade-level conflict cells where two or more projects compete for the same
 * trade in the same week beyond available supply. Nested under Projects
 * (/projects/schedule), not a new sidebar item — Peter's own §1.1 feedback
 * was "fewer top-level tabs".
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const projects = await db.project.findMany({
      where: { startDate: { lte: to }, endDate: { gte: from } },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        activities: {
          where: { startDate: { lte: to }, endDate: { gte: from } },
          select: {
            id: true,
            parentId: true,
            name: true,
            trade: true,
            startDate: true,
            endDate: true,
            isCritical: true,
            labourRequired: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const activities = projects.flatMap((p) =>
      p.activities.map((a) => ({ ...a, projectId: p.id, projectName: p.name }))
    );

    const weekCount = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (7 * DAY_MS)) + 1);
    const weeks = weekSequence(from, weekCount);
    const workers = await db.worker.findMany({
      select: { capability: true, status: true, leave: { select: { startDate: true, endDate: true } } },
    });
    const supply = computeWeeklySupply(workers, weeks);

    const activitiesByProject = new Map<string, ProjectActivities>();
    for (const project of projects) {
      activitiesByProject.set(project.id, {
        projectName: project.name,
        activities: project.activities.map((a) => ({
          id: a.id,
          parentId: a.parentId,
          startDate: a.startDate,
          endDate: a.endDate,
          labourRequired: a.labourRequired as Record<string, number>,
        })),
      });
    }

    const conflicts = findTradeConflicts(activitiesByProject, supply);

    return NextResponse.json({
      projects: projects.map((p) => ({ id: p.id, name: p.name, code: p.code, status: p.status })),
      activities,
      conflicts,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
