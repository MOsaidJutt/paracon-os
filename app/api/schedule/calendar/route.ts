import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { weekKey, weekSequence } from "@/lib/dates";
import { classifyRag, computeWeeklySupply } from "@/lib/forecast/engine";
import { loadForecastConfig } from "@/lib/forecast/config";
import { aggregateCombinedDemand, findTradeConflicts, type ProjectActivities } from "@/lib/schedule/conflicts";

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

    // Combined weekly demand-by-trade across every listed project, RAG-classified
    // against the same org-wide supply and thresholds the Forecast matrix uses —
    // the multi-project Gantt's "total labour required" summary strip.
    const combinedDemand = aggregateCombinedDemand(activitiesByProject);
    const ragThresholds = (await loadForecastConfig(session.user.organisationId)).ragThresholds;
    const weekKeys = weeks.map(weekKey);
    const roles = Array.from(new Set(Object.values(combinedDemand).flatMap((r) => Object.keys(r)))).sort();
    const demandCells = weekKeys.flatMap((week) =>
      roles.map((role) => {
        const demand = combinedDemand[week]?.[role] ?? 0;
        const roleSupply = supply[week]?.[role] ?? 0;
        return { week, role, demand, supply: roleSupply, ...classifyRag(demand, roleSupply, ragThresholds) };
      })
    );

    return NextResponse.json({
      projects: projects.map((p) => ({ id: p.id, name: p.name, code: p.code, status: p.status })),
      activities,
      conflicts,
      weeks: weekKeys,
      roles,
      demandCells,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
