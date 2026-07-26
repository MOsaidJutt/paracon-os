import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "@/lib/dates";
import { bandForPercent, type RagBand } from "./rag";
import { loadSimpleDashboardConfig } from "./simple-config";

/**
 * The ranked breakdown behind a Worker KPI bar — who is pulling the number up
 * and who is pulling it down. Loaded on demand when a bar is tapped, never as
 * part of the dashboard payload: four ranked lists of every worker would
 * dominate a response whose whole point is to render fast.
 */
export const workerKpiMetricSchema = z.enum(["attendance", "hours", "compliance", "scorecard"]);
export type WorkerKpiMetric = z.infer<typeof workerKpiMetricSchema>;

export type WorkerKpiRow = {
  id: string;
  name: string;
  /** Trade for a worker-level metric; empty for the trade-level one, where `name` is already the trade. */
  subtitle: string;
  percent: number;
  band: RagBand;
  detail: string;
  /** Absent for the trade-level metric, which has no worker record to open. */
  href: string | null;
};

export type WorkerKpiBreakdown = {
  metric: WorkerKpiMetric;
  title: string;
  /** True when rows are trades rather than people, so the UI can say so instead of implying otherwise. */
  byTrade: boolean;
  rows: WorkerKpiRow[];
};

/** The permission each metric requires. Lives beside the service so the route can't drift from it. */
export const WORKER_KPI_PERMISSION: Record<WorkerKpiMetric, string> = {
  attendance: "labour.view",
  hours: "labour.view",
  compliance: "labour.view",
  scorecard: "scorecard.view",
};

const TITLE: Record<WorkerKpiMetric, string> = {
  attendance: "Attendance",
  hours: "Hours vs plan",
  compliance: "Compliance current",
  scorecard: "Scorecard average",
};

export async function getWorkerKpiBreakdown(
  organisationId: string,
  metric: WorkerKpiMetric,
  now: Date = new Date()
): Promise<WorkerKpiBreakdown> {
  const config = await loadSimpleDashboardConfig(organisationId);
  const band = (percent: number) =>
    bandForPercent(percent, config.kpiGoodThreshold, config.kpiWarningThreshold);

  const periodStart = startOfMonth(now);
  const periodEnd = endOfMonth(now);

  if (metric === "attendance") {
    // Attendance carries no organisationId of its own — it's scoped through
    // its parent DailySiteUpdate, the same way lib/tenant.ts documents it.
    const rows = await prisma.attendance.findMany({
      where: { dailySiteUpdate: { organisationId, date: { gte: periodStart, lt: periodEnd } } },
      select: { present: true, worker: { select: { id: true, name: true, capability: true } } },
    });

    const byWorker = new Map<string, { name: string; capability: string; present: number; total: number }>();
    for (const row of rows) {
      const entry = byWorker.get(row.worker.id) ?? {
        name: row.worker.name,
        capability: row.worker.capability,
        present: 0,
        total: 0,
      };
      entry.total += 1;
      if (row.present) entry.present += 1;
      byWorker.set(row.worker.id, entry);
    }

    return {
      metric,
      title: TITLE[metric],
      byTrade: false,
      rows: rank(
        Array.from(byWorker.entries()).map(([id, entry]) => {
          const percent = (entry.present / entry.total) * 100;
          return {
            id,
            name: entry.name,
            subtitle: entry.capability,
            percent,
            band: band(percent),
            detail: `${entry.present} of ${entry.total} days`,
            href: `/labour/${id}`,
          };
        })
      ),
    };
  }

  if (metric === "hours") {
    // Planned hours only exist per project x trade (ProgramActivity carries a
    // headcount per trade, not per named worker), so this one ranks trades.
    const records = await prisma.productivityRecord.findMany({
      where: { organisationId, periodStart },
      select: { trade: true, plannedHours: true, actualHours: true },
    });

    const byTrade = new Map<string, { planned: number; actual: number }>();
    for (const record of records) {
      const entry = byTrade.get(record.trade) ?? { planned: 0, actual: 0 };
      entry.planned += record.plannedHours;
      entry.actual += record.actualHours;
      byTrade.set(record.trade, entry);
    }

    return {
      metric,
      title: TITLE[metric],
      byTrade: true,
      rows: rank(
        Array.from(byTrade.entries())
          .filter(([, entry]) => entry.actual > 0)
          .map(([trade, entry]) => {
            const percent = Math.min(100, (entry.planned / entry.actual) * 100);
            return {
              id: trade,
              name: trade,
              subtitle: "",
              percent,
              band: band(percent),
              detail: `${Math.round(entry.actual)}h worked vs ${Math.round(entry.planned)}h planned`,
              href: null,
            };
          })
      ),
    };
  }

  if (metric === "compliance") {
    const rows = await prisma.compliance.findMany({
      where: { organisationId },
      select: { status: true, worker: { select: { id: true, name: true, capability: true } } },
    });

    const byWorker = new Map<string, { name: string; capability: string; valid: number; total: number }>();
    for (const row of rows) {
      const entry = byWorker.get(row.worker.id) ?? {
        name: row.worker.name,
        capability: row.worker.capability,
        valid: 0,
        total: 0,
      };
      entry.total += 1;
      if (row.status === "Valid") entry.valid += 1;
      byWorker.set(row.worker.id, entry);
    }

    return {
      metric,
      title: TITLE[metric],
      byTrade: false,
      rows: rank(
        Array.from(byWorker.entries()).map(([id, entry]) => {
          const percent = (entry.valid / entry.total) * 100;
          return {
            id,
            name: entry.name,
            subtitle: entry.capability,
            percent,
            band: band(percent),
            detail: `${entry.valid} of ${entry.total} documents valid`,
            href: `/labour/${id}`,
          };
        })
      ),
    };
  }

  const scores = await prisma.staffScore.findMany({
    where: { organisationId, period: periodStart },
    select: { overallScore: true, worker: { select: { id: true, name: true, capability: true } } },
  });

  return {
    metric,
    title: TITLE[metric],
    byTrade: false,
    rows: rank(
      scores.map((score) => ({
        id: score.worker.id,
        name: score.worker.name,
        subtitle: score.worker.capability,
        percent: score.overallScore,
        band: band(score.overallScore),
        detail: `${Math.round(score.overallScore)} out of 100`,
        href: `/labour/${score.worker.id}`,
      }))
    ),
  };
}

/** Worst first: a ranked list on a dashboard exists to surface who needs attention, not to hand out prizes. */
function rank(rows: WorkerKpiRow[]): WorkerKpiRow[] {
  return [...rows].sort((a, b) => a.percent - b.percent);
}
