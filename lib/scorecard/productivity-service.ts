import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, overlapDays } from "@/lib/dates";
import { loadScorecardConfig } from "./config";
import {
  allocatePlannedHoursShare,
  calcCostPerHour,
  calcOutputRatio,
  calcReliabilityPct,
} from "./productivity";

type LabourRequired = Record<string, number>;

/**
 * Recomputes ProductivityRecord (one row per project x trade) for every
 * project active in the given month, from ProgramActivity (planned hours —
 * headcount x calendar-day overlap x standardHoursPerDay; a calendar-day
 * approximation, not a working-day calendar) and Attendance (actual hours +
 * reliability, via the daily update's date and the present worker's
 * capability). Mirrors recomputeAllCompliance's "load -> diff -> upsert"
 * shape, run nightly + on demand (lib/inngest/functions/recompute-productivity.ts).
 */
export async function recomputeProductivity(organisationId: string, monthDate: Date) {
  const periodStart = startOfMonth(monthDate);
  const periodEnd = endOfMonth(monthDate);
  const config = await loadScorecardConfig(organisationId);

  const projects = await prisma.project.findMany({
    where: { organisationId, startDate: { lt: periodEnd }, endDate: { gte: periodStart } },
    select: { id: true, value: true },
  });

  let recordsUpserted = 0;

  for (const project of projects) {
    const [activities, attendanceRows] = await Promise.all([
      prisma.programActivity.findMany({
        where: { organisationId, projectId: project.id, startDate: { lt: periodEnd }, endDate: { gte: periodStart } },
        select: { startDate: true, endDate: true, labourRequired: true },
      }),
      prisma.attendance.findMany({
        where: { dailySiteUpdate: { organisationId, projectId: project.id, date: { gte: periodStart, lt: periodEnd } } },
        select: { present: true, hours: true, worker: { select: { capability: true } } },
      }),
    ]);

    const plannedHoursByTrade: Record<string, number> = {};
    for (const activity of activities) {
      const days = overlapDays(periodStart, periodEnd, activity.startDate, activity.endDate);
      const labourRequired = activity.labourRequired as LabourRequired;
      for (const [trade, headcount] of Object.entries(labourRequired)) {
        const hours = headcount * days * config.standardHoursPerDay;
        plannedHoursByTrade[trade] = (plannedHoursByTrade[trade] ?? 0) + hours;
      }
    }

    const actualHoursByTrade: Record<string, number> = {};
    const attendanceDaysByTrade: Record<string, number> = {};
    const expectedDaysByTrade: Record<string, number> = {};
    for (const row of attendanceRows) {
      const trade = row.worker.capability;
      expectedDaysByTrade[trade] = (expectedDaysByTrade[trade] ?? 0) + 1;
      if (row.present) {
        attendanceDaysByTrade[trade] = (attendanceDaysByTrade[trade] ?? 0) + 1;
        actualHoursByTrade[trade] = (actualHoursByTrade[trade] ?? 0) + (row.hours ?? 0);
      }
    }

    const plannedHoursShareByTrade = allocatePlannedHoursShare(plannedHoursByTrade);
    const trades = new Set([...Object.keys(plannedHoursByTrade), ...Object.keys(actualHoursByTrade)]);

    await Promise.all(
      Array.from(trades).map((trade) => {
        const plannedHours = plannedHoursByTrade[trade] ?? 0;
        const actualHours = actualHoursByTrade[trade] ?? 0;
        const attendanceDays = attendanceDaysByTrade[trade] ?? 0;
        const expectedDays = expectedDaysByTrade[trade] ?? 0;
        const plannedHoursShare = plannedHoursShareByTrade[trade] ?? 0;

        return prisma.productivityRecord.upsert({
          where: { organisationId_projectId_trade_periodStart: { organisationId, projectId: project.id, trade, periodStart } },
          update: {
            periodEnd,
            plannedHours,
            actualHours,
            outputRatio: calcOutputRatio(plannedHours, actualHours),
            attendanceDays,
            expectedDays,
            reliabilityPct: calcReliabilityPct(attendanceDays, expectedDays),
            plannedHoursShare,
            costPerHour: calcCostPerHour(project.value, plannedHoursShare, actualHours),
          },
          create: {
            organisationId,
            projectId: project.id,
            trade,
            periodStart,
            periodEnd,
            plannedHours,
            actualHours,
            outputRatio: calcOutputRatio(plannedHours, actualHours),
            attendanceDays,
            expectedDays,
            reliabilityPct: calcReliabilityPct(attendanceDays, expectedDays),
            plannedHoursShare,
            costPerHour: calcCostPerHour(project.value, plannedHoursShare, actualHours),
          },
        });
      })
    );
    recordsUpserted += trades.size;
  }

  return { projectsProcessed: projects.length, recordsUpserted, periodStart, periodEnd };
}

export type ProductivityTrendFilter = {
  trade?: string;
  projectId?: string;
};

export const PRODUCTIVITY_TRENDS_PAGE_SIZE = 25;

/** Paginated trend rows for the Productivity dashboard, most recent month first — grows unbounded over time (months x projects x trades), same shape as AiUsageLog/AuditLog. */
export async function getProductivityTrends(organisationId: string, filter: ProductivityTrendFilter = {}, page = 1) {
  const where = { organisationId, trade: filter.trade, projectId: filter.projectId };

  const [records, total] = await Promise.all([
    prisma.productivityRecord.findMany({
      where,
      include: { project: { select: { id: true, name: true, code: true } } },
      orderBy: [{ periodStart: "desc" }, { trade: "asc" }],
      skip: (page - 1) * PRODUCTIVITY_TRENDS_PAGE_SIZE,
      take: PRODUCTIVITY_TRENDS_PAGE_SIZE,
    }),
    prisma.productivityRecord.count({ where }),
  ]);

  return { records, total, page, pageSize: PRODUCTIVITY_TRENDS_PAGE_SIZE };
}

export type WorkerAutoMetrics = {
  reliabilityPct: number | null;
  outputRatio: number | null;
};

/**
 * The two AUTO-sourced inputs for a key staff member's monthly scorecard:
 * personal attendance rate (their own Attendance rows, any project, this
 * month) and their trade's average output ratio across the
 * ProductivityRecord rows for projects they actually attended this month.
 */
export async function getWorkerAutoMetrics(organisationId: string, workerId: string, monthDate: Date): Promise<WorkerAutoMetrics> {
  const periodStart = startOfMonth(monthDate);
  const periodEnd = endOfMonth(monthDate);

  const worker = await prisma.worker.findFirst({ where: { id: workerId, organisationId }, select: { capability: true } });
  if (!worker) return { reliabilityPct: null, outputRatio: null };

  const attendanceRows = await prisma.attendance.findMany({
    where: { workerId, dailySiteUpdate: { organisationId, date: { gte: periodStart, lt: periodEnd } } },
    select: { present: true, dailySiteUpdate: { select: { projectId: true } } },
  });

  const presentDays = attendanceRows.filter((a) => a.present).length;
  const reliabilityPct = calcReliabilityPct(presentDays, attendanceRows.length);

  const projectIds = [...new Set(attendanceRows.map((a) => a.dailySiteUpdate.projectId))];
  const productivityRecords = projectIds.length
    ? await prisma.productivityRecord.findMany({
        where: { organisationId, projectId: { in: projectIds }, trade: worker.capability, periodStart },
        select: { outputRatio: true },
      })
    : [];

  const ratios = productivityRecords.map((r) => r.outputRatio).filter((r): r is number => r !== null);
  const outputRatio = ratios.length ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length : null;

  return { reliabilityPct, outputRatio };
}
