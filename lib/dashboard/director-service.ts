import { prisma } from "@/lib/prisma";
import { weekSequence, weekKey } from "@/lib/dates";
import { loadDashboardHealthConfig } from "./config";
import { computeProjectHealth, type ProjectHealthStatus } from "./health";
import { deriveShortageAlerts, getComplianceAlerts, sortAlerts, type Alert } from "./alerts";
import { aggregateLabourDemand, aggregateAllocatedByTrade, filterUpcomingMilestones } from "@/lib/projects/calculations";
import { loadTenderConfig } from "@/lib/tenders/config";
import { activeStatusesFromWeights, calcPipelineSummary } from "@/lib/tenders/calculations";
import { computeForecastResult } from "@/lib/forecast/snapshot";
import type { CapacityHeadroom } from "@/lib/forecast/engine";

export type ProjectHealthRow = { id: string; name: string; code: string; status: ProjectHealthStatus; reasons: string[] };

export type DirectorDashboard = {
  projects: ProjectHealthRow[];
  atRisk: ProjectHealthRow[];
  criticalDates: { id: string; name: string; date: string; project: { id: string; name: string; code: string } }[];
  // Same shape CapacityHeadroomCard (components/forecast/capacity-headroom.tsx)
  // already renders — reused as-is, no new capacity card needed.
  capacity: CapacityHeadroom;
  pipeline: { weightedPipeline: number; totalPipeline: number; activeBids: number; winRateValue: number };
  alerts: Alert[];
};

/** Per-project labour shortfall for the current week + the health config's watch window, used only to feed computeProjectHealth. */
function computeWeeklyShortfall(
  activities: { id: string; parentId: string | null; startDate: Date; endDate: Date; labourRequired: Record<string, number> }[],
  allocations: { weekStart: Date; trade: string }[],
  weeks: string[]
): number[] {
  const demand = aggregateLabourDemand(activities);
  const allocated = aggregateAllocatedByTrade(allocations);

  return weeks.map((week) => {
    const demandWeek = demand[week] ?? {};
    const allocatedWeek = allocated[week] ?? {};
    const roles = new Set([...Object.keys(demandWeek), ...Object.keys(allocatedWeek)]);
    let shortfall = 0;
    for (const role of roles) shortfall += Math.max(0, (demandWeek[role] ?? 0) - (allocatedWeek[role] ?? 0));
    return shortfall;
  });
}

const RISK_ORDER: Record<ProjectHealthStatus, number> = { Critical: 0, Attention: 1, "On Track": 2 };

/**
 * Composes the Director Command Centre entirely from existing calculation
 * helpers: project health is derived here (no schema field for it), but
 * capacity reuses the Phase 5 forecast engine's headroom computation and the
 * pipeline snapshot reuses the tender dashboard's own pipeline summary — no
 * new capacity or pipeline math.
 */
export async function getDirectorDashboard(
  organisationId: string,
  options: { projectId?: string } = {},
  now: Date = new Date()
): Promise<DirectorDashboard> {
  // None of these depend on each other's result, so they're fired together
  // rather than as sequential round trips — materially cheaper against a
  // remote Postgres connection.
  const [healthConfig, projects, milestoneRows, forecastResult, tenderConfig, tenders, complianceAlerts] =
    await Promise.all([
      loadDashboardHealthConfig(organisationId),
      prisma.project.findMany({
        where: { organisationId, ...(options.projectId ? { id: options.projectId } : {}) },
        select: {
          id: true,
          name: true,
          code: true,
          milestones: { select: { date: true } },
          issues: { where: { status: { not: "Resolved" } }, select: { severity: true } },
          activities: { select: { id: true, parentId: true, startDate: true, endDate: true, labourRequired: true } },
          allocations: { select: { weekStart: true, worker: { select: { capability: true } } } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.milestone.findMany({
        where: { organisationId, date: { gte: now }, ...(options.projectId ? { projectId: options.projectId } : {}) },
        orderBy: { date: "asc" },
        include: { project: { select: { id: true, name: true, code: true } } },
      }),
      computeForecastResult(organisationId, now),
      loadTenderConfig(organisationId),
      prisma.tender.findMany({
        where: { organisationId },
        select: {
          id: true,
          clientId: true,
          status: true,
          value: true,
          winProbabilityNumeric: true,
          outcome: true,
          winningBid: true,
          valueBand: true,
          received: true,
          due: true,
          submitted: true,
          tenderDurationDays: true,
        },
      }),
      getComplianceAlerts(organisationId),
    ]);

  const weeks = weekSequence(now, healthConfig.shortageWatchWeeks + 1).map(weekKey);

  const projectRows: ProjectHealthRow[] = projects.map((project) => {
    const weeklyShortfall = computeWeeklyShortfall(
      project.activities.map((a) => ({ ...a, labourRequired: a.labourRequired as Record<string, number> })),
      project.allocations.map((a) => ({ weekStart: a.weekStart, trade: a.worker.capability })),
      weeks
    );

    const { status, reasons } = computeProjectHealth(
      {
        now,
        milestoneDates: project.milestones.map((m) => m.date),
        openIssueSeverities: project.issues.map((i) => i.severity),
        weeklyShortfall,
      },
      healthConfig
    );

    return { id: project.id, name: project.name, code: project.code, status, reasons };
  });

  const atRisk = projectRows
    .filter((p) => p.status !== "On Track")
    .sort((a, b) => RISK_ORDER[a.status] - RISK_ORDER[b.status]);

  const criticalDates = filterUpcomingMilestones(milestoneRows, now, 30).map((m) => ({
    id: m.id,
    name: m.name,
    date: m.date.toISOString(),
    project: m.project,
  }));

  const activeTenderStatuses = activeStatusesFromWeights(tenderConfig.statusWeights);
  const pipelineSummary = calcPipelineSummary(tenders, activeTenderStatuses);

  const shortageAlerts = deriveShortageAlerts(
    forecastResult.headroom.shortages.map((s) => ({ role: s.role, weekIndex: s.blockIndex, gap: s.gap }))
  );
  const alerts = sortAlerts([...shortageAlerts, ...complianceAlerts]);

  return {
    projects: projectRows,
    atRisk,
    criticalDates,
    capacity: forecastResult.headroom,
    pipeline: {
      weightedPipeline: pipelineSummary.weightedPipeline,
      totalPipeline: pipelineSummary.totalPipeline,
      activeBids: pipelineSummary.activeBids,
      winRateValue: pipelineSummary.winRateValue,
    },
    alerts,
  };
}
