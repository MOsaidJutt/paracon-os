import { prisma } from "@/lib/prisma";
import { weekSequence, weekKey } from "@/lib/dates";
import { loadDashboardHealthConfig } from "./config";
import { computeProjectHealth, type ProjectHealthStatus } from "./health";
import { deriveShortageAlerts, getComplianceAlerts, sortAlerts, type Alert, type ShortageGapInput } from "./alerts";
import { aggregateLabourDemand, aggregateAllocatedByTrade } from "@/lib/projects/calculations";

export type ProjectHealthRow = { id: string; name: string; code: string; status: ProjectHealthStatus; reasons: string[] };
export type LookaheadActivity = {
  id: string;
  name: string;
  trade: string;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
};
export type LabourWeekRow = { week: string; trade: string; demand: number; allocated: number };
export type DeliveryStatusRow = { status: string; count: number };
export type OpenIssueRow = {
  id: string;
  description: string;
  severity: string;
  // Derived from the same dashboard.health.criticalIssueSeverities config
  // computeProjectHealth() uses — keeps the UI's "is this the worst kind of
  // issue" badge in sync with the admin-editable severity taxonomy instead
  // of a hardcoded severity string.
  isCritical: boolean;
  status: string;
  projectId: string;
  projectName: string;
};

export type PmDashboard = {
  projects: ProjectHealthRow[];
  lookahead: LookaheadActivity[];
  labour: LabourWeekRow[];
  deliveries: DeliveryStatusRow[];
  openIssues: OpenIssueRow[];
  alerts: Alert[];
};

/**
 * Composes the PM dashboard for one PM's own projects (the org chart's
 * "PM runs 5-6 projects" — never the whole org). Reuses the same
 * demand/allocated aggregation Phase 5/9 already built; only the per-PM
 * scoping and the week/trade roll-up across their projects is new here.
 */
export async function getPmDashboard(
  organisationId: string,
  pmUserId: string,
  options: { projectId?: string } = {},
  now: Date = new Date()
): Promise<PmDashboard> {
  const lookaheadWeeks = 3;
  const lookaheadEnd = new Date(now.getTime() + lookaheadWeeks * 7 * 86_400_000);

  // Independent of each other — fired together rather than as sequential
  // round trips against the remote Postgres connection.
  const [healthConfig, projects] = await Promise.all([
    loadDashboardHealthConfig(organisationId),
    prisma.project.findMany({
      where: { organisationId, pmUserId, ...(options.projectId ? { id: options.projectId } : {}) },
      select: {
        id: true,
        name: true,
        code: true,
        milestones: { select: { date: true } },
        issues: {
          where: { status: { not: "Resolved" } },
          select: { id: true, description: true, severity: true, status: true },
        },
        activities: {
          select: {
            id: true,
            parentId: true,
            name: true,
            trade: true,
            startDate: true,
            endDate: true,
            labourRequired: true,
          },
        },
        allocations: { select: { weekStart: true, worker: { select: { capability: true } } } },
        deliveries: { select: { status: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const weeks = weekSequence(now, Math.max(healthConfig.shortageWatchWeeks, lookaheadWeeks) + 1).map(weekKey);

  const projectRows: ProjectHealthRow[] = [];
  const lookahead: LookaheadActivity[] = [];
  const openIssues: OpenIssueRow[] = [];
  const deliveryCounts = new Map<string, number>();
  const shortageEntries: ShortageGapInput[] = [];
  const labourMap: Record<string, Record<string, { demand: number; allocated: number }>> = {};

  for (const project of projects) {
    const demand = aggregateLabourDemand(
      project.activities.map((a) => ({ ...a, labourRequired: a.labourRequired as Record<string, number> }))
    );
    const allocated = aggregateAllocatedByTrade(
      project.allocations.map((a) => ({ weekStart: a.weekStart, trade: a.worker.capability }))
    );

    const weeklyShortfall = weeks.map((week, weekIndex) => {
      const demandWeek = demand[week] ?? {};
      const allocatedWeek = allocated[week] ?? {};
      const roles = new Set([...Object.keys(demandWeek), ...Object.keys(allocatedWeek)]);
      let shortfall = 0;
      for (const role of roles) {
        const gap = (demandWeek[role] ?? 0) - (allocatedWeek[role] ?? 0);
        if (gap > 0) shortageEntries.push({ projectId: project.id, projectName: project.name, role, weekIndex, gap });
        shortfall += Math.max(0, gap);

        const bucket = (labourMap[week] ??= {});
        const cell = (bucket[role] ??= { demand: 0, allocated: 0 });
        cell.demand += demandWeek[role] ?? 0;
        cell.allocated += allocatedWeek[role] ?? 0;
      }
      return shortfall;
    });

    const { status, reasons } = computeProjectHealth(
      {
        now,
        milestoneDates: project.milestones.map((m) => m.date),
        openIssueSeverities: project.issues.map((i) => i.severity),
        weeklyShortfall,
      },
      healthConfig
    );
    projectRows.push({ id: project.id, name: project.name, code: project.code, status, reasons });

    for (const activity of project.activities) {
      if (activity.startDate <= lookaheadEnd && activity.endDate >= now) {
        lookahead.push({
          id: activity.id,
          name: activity.name,
          trade: activity.trade,
          projectId: project.id,
          projectName: project.name,
          startDate: activity.startDate.toISOString(),
          endDate: activity.endDate.toISOString(),
        });
      }
    }

    for (const issue of project.issues) {
      openIssues.push({
        id: issue.id,
        description: issue.description,
        severity: issue.severity,
        isCritical: healthConfig.criticalIssueSeverities.includes(issue.severity),
        status: issue.status,
        projectId: project.id,
        projectName: project.name,
      });
    }

    for (const delivery of project.deliveries) {
      deliveryCounts.set(delivery.status, (deliveryCounts.get(delivery.status) ?? 0) + 1);
    }
  }

  lookahead.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const labour: LabourWeekRow[] = [];
  for (const [week, roles] of Object.entries(labourMap).sort(([a], [b]) => a.localeCompare(b))) {
    for (const [trade, { demand, allocated }] of Object.entries(roles)) {
      labour.push({ week, trade, demand, allocated });
    }
  }

  const shortageAlerts = deriveShortageAlerts(shortageEntries);
  const complianceAlerts = await getComplianceAlerts(organisationId, projects.map((p) => p.id));
  const alerts = sortAlerts([...shortageAlerts, ...complianceAlerts]);

  return {
    projects: projectRows,
    lookahead,
    labour,
    deliveries: Array.from(deliveryCounts.entries()).map(([status, count]) => ({ status, count })),
    openIssues,
    alerts,
  };
}
