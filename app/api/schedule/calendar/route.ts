import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { weekKey, weekSequence } from "@/lib/dates";
import { classifyRag, computeWeeklySupply } from "@/lib/forecast/engine";
import { loadForecastConfig } from "@/lib/forecast/config";
import { loadScheduleConfig } from "@/lib/schedule/config";
import { aggregateCombinedDemand, findTradeConflicts, type ProjectActivities } from "@/lib/schedule/conflicts";
import { computeDelayDays, computeGanttStatus } from "@/lib/schedule/gantt-status";

const DAY_MS = 86_400_000;

type CrossProjectImpactEntry = {
  workerId: string;
  workerName: string;
  otherProjectId: string;
  otherProjectName: string;
  conflictWeeks: string[];
};

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
            status: true,
            responsible: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const activityIds = projects.flatMap((p) => p.activities.map((a) => a.id));
    const projectIds = projects.map((p) => p.id);

    const [latestBaselines, delayRecords, dependencyEdges, scheduleConfig] = await Promise.all([
      db.baseline.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { createdAt: "desc" },
        include: { tasks: { select: { activityId: true, startDate: true, endDate: true } } },
      }),
      db.delayRecord.findMany({
        where: { activityId: { in: activityIds } },
        orderBy: { createdAt: "desc" },
        select: { activityId: true, reason: true, downstreamImpactedJson: true },
      }),
      db.dependency.findMany({
        where: { successorId: { in: activityIds } },
        select: { predecessorId: true, successorId: true },
      }),
      loadScheduleConfig(session.user.organisationId),
    ]);

    // Both lists are ordered createdAt desc, so the first row seen per
    // project/activity is the most recent — no separate "latest" query needed.
    const baselineByProject = new Map<string, (typeof latestBaselines)[number]>();
    for (const b of latestBaselines) {
      if (!baselineByProject.has(b.projectId)) baselineByProject.set(b.projectId, b);
    }
    const baselineTaskByActivity = new Map<string, { startDate: Date; endDate: Date }>();
    for (const baseline of baselineByProject.values()) {
      for (const t of baseline.tasks) {
        baselineTaskByActivity.set(t.activityId, { startDate: t.startDate, endDate: t.endDate });
      }
    }

    const latestDelayByActivity = new Map<string, (typeof delayRecords)[number]>();
    for (const d of delayRecords) {
      if (!latestDelayByActivity.has(d.activityId)) latestDelayByActivity.set(d.activityId, d);
    }

    const nameByActivity = new Map(projects.flatMap((p) => p.activities.map((a) => [a.id, a.name] as const)));
    const predecessorNamesBySuccessor = new Map<string, string[]>();
    for (const dep of dependencyEdges) {
      const name = nameByActivity.get(dep.predecessorId);
      if (!name) continue;
      const list = predecessorNamesBySuccessor.get(dep.successorId) ?? [];
      list.push(name);
      predecessorNamesBySuccessor.set(dep.successorId, list);
    }

    const activities = projects.flatMap((p) =>
      p.activities.map((a) => {
        const baselineTask = baselineTaskByActivity.get(a.id) ?? null;
        const delay = latestDelayByActivity.get(a.id) ?? null;
        // Read-only, never recomputed here — the snowball was already computed
        // and frozen into DelayRecord.downstreamImpactedJson at commit-move time.
        const crossProjectImpact: CrossProjectImpactEntry[] = delay && !Array.isArray(delay.downstreamImpactedJson)
          ? ((delay.downstreamImpactedJson as { crossProjectImpact?: CrossProjectImpactEntry[] }).crossProjectImpact ?? [])
          : [];

        return {
          ...a,
          projectId: p.id,
          projectName: p.name,
          baselineStartDate: baselineTask?.startDate ?? null,
          baselineEndDate: baselineTask?.endDate ?? null,
          delayDays: computeDelayDays(baselineTask?.endDate ?? null, a.endDate),
          ganttStatus: computeGanttStatus(
            { today: now, currentEndDate: a.endDate, isComplete: a.status === "Complete" },
            scheduleConfig.ganttAtRiskThresholdDays
          ),
          impactReason: delay?.reason ?? null,
          predecessorName: (predecessorNamesBySuccessor.get(a.id) ?? []).join(", ") || null,
          crossProjectImpact,
        };
      })
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
