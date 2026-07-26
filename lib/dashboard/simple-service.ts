import { prisma } from "@/lib/prisma";
import { startOfMonth } from "@/lib/dates";
import { formatCurrency } from "@/lib/tenders/format";
import { bandForPercent, type RagBand } from "./rag";
import { getDirectorDashboard, type ProjectHealthRow } from "./director-service";
import { loadSimpleDashboardConfig } from "./simple-config";
import { buildChecklist, activePeriodKeys, type ChecklistEntry } from "./checklist";
import {
  attendancePercent,
  averageScore,
  complianceCurrentPercent,
  labourEfficiencyPercent,
  labourUtilisationPercent,
  projectsOnTrackPercent,
  ratePercent,
  revenueWonPercent,
  tradeUtilisation,
  type Percent,
  type TradeUtilisation,
} from "./simple-metrics";
import { availableKpiSlots, resolveKpiSlots, type KpiSlotId, type KpiSlotMeta } from "./kpi-slots";
import type { Alert } from "./alerts";
import type { CapacityHeadroom } from "@/lib/forecast/engine";

export type KpiRingData = {
  id: KpiSlotId;
  title: string;
  /** null = no data yet. The UI shows a dash and an explanation, never a red zero. */
  percent: Percent;
  band: RagBand;
  /** The raw figures behind the percentage, e.g. "$3.4M of $5.0M". */
  detail: string;
  explanation: string;
};

export type BarDatum = { label: string; percent: Percent; band: RagBand; valueLabel: string };

export type SimpleDashboard = {
  rings: KpiRingData[];
  projects: ProjectHealthRow[];
  criticalDates: { id: string; name: string; date: string; project: { id: string; name: string; code: string } }[];
  capacity: (CapacityHeadroom & { trades: TradeUtilisation[] }) | null;
  alerts: Alert[];
  checklist: ChecklistEntry[];
  workerKpis: BarDatum[];
  roleScorecard: BarDatum[];
  pipeline: { weightedPipeline: number; totalPipeline: number; activeBids: number; revenueWon: number } | null;
  /** Which widgets have data the caller is allowed to see — the renderer hides the rest outright rather than showing an empty card. */
  visibleWidgets: string[];
};

type Scope = {
  tenders: boolean;
  projects: boolean;
  forecast: boolean;
  labour: boolean;
  scorecard: boolean;
};

function scopeFor(permissions: string[]): Scope {
  return {
    tenders: permissions.includes("tender.view"),
    projects: permissions.includes("project.view"),
    forecast: permissions.includes("forecast.view"),
    labour: permissions.includes("labour.view"),
    scorecard: permissions.includes("scorecard.view"),
  };
}

/** Compact money for a ring's detail line — "$3.4M of $5.0M" reads at a glance where "$3,412,000" does not. */
function compactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return formatCurrency(value);
}

function bandFor(percent: Percent, good: number, warning: number): RagBand {
  // No signal is not a failing grade. Amber reads as "look at this", which is
  // exactly right for a KPI nobody has fed data into yet.
  if (percent === null) return "warning";
  return bandForPercent(percent, good, warning);
}

/**
 * Composes the simplified dashboard.
 *
 * Everything here is a re-presentation of data that already existed: project
 * health, capacity, alerts, critical dates and the pipeline all come straight
 * from getDirectorDashboard (the Full view's own service), and the worker KPIs
 * read the ProductivityRecord/Compliance/StaffScore rows the Phase 8-11 build
 * already maintains. No new business logic, no second source of truth — the
 * only new maths is the percentage arithmetic in ./simple-metrics.ts.
 *
 * `permissions` decides what's computed AND what's returned: a user without
 * tender.view never sees a pipeline figure, and a user without forecast.view
 * never sees capacity. That's what lets Director, PM, Estimator and Viewer all
 * land on this one page instead of four.
 */
export async function getSimpleDashboard(
  organisationId: string,
  userId: string,
  permissions: string[],
  savedRingSlots: unknown,
  now: Date = new Date()
): Promise<SimpleDashboard> {
  const scope = scopeFor(permissions);
  const config = await loadSimpleDashboardConfig(organisationId);
  const { kpiGoodThreshold: good, kpiWarningThreshold: warning } = config;

  const needsOrgReading = scope.tenders || scope.projects || scope.forecast;
  // ProductivityRecord and StaffScore are both keyed by the first of the
  // month, so one period marker serves both lookups.
  const periodStart = startOfMonth(now);

  const [directorReading, tenderCounts, complianceStatuses, productivityRecords, staffScores, ticks] =
    await Promise.all([
      needsOrgReading ? getDirectorDashboard(organisationId, {}, now) : null,
      scope.tenders
        ? prisma.tender.findMany({ where: { organisationId }, select: { outcome: true } })
        : null,
      scope.labour
        ? prisma.compliance.findMany({ where: { organisationId }, select: { status: true } })
        : null,
      scope.labour
        ? prisma.productivityRecord.findMany({
            where: { organisationId, periodStart },
            select: { attendanceDays: true, expectedDays: true, plannedHours: true, actualHours: true },
          })
        : null,
      scope.scorecard
        ? prisma.staffScore.findMany({
            where: { organisationId, period: periodStart },
            select: { overallScore: true, worker: { select: { capability: true } } },
          })
        : null,
      prisma.kpiChecklistTick.findMany({
        where: { organisationId, userId, periodKey: { in: activePeriodKeys(now) } },
        select: { itemKey: true, periodKey: true },
      }),
    ]);

  const wonCount = tenderCounts?.filter((t) => t.outcome === "Won").length ?? 0;
  const resolvedCount = tenderCounts?.filter((t) => t.outcome === "Won" || t.outcome === "Lost").length ?? 0;
  const totalTenders = tenderCounts?.length ?? 0;
  const submittedShare = directorReading?.pipeline;

  const ringValues: Record<KpiSlotId, { percent: Percent; detail: string }> = {
    "revenue-won": {
      percent:
        directorReading && scope.tenders
          ? revenueWonPercent(directorReading.pipeline.revenueWon, config.revenueTargetAud)
          : null,
      detail: directorReading
        ? `${compactCurrency(directorReading.pipeline.revenueWon)} of ${compactCurrency(config.revenueTargetAud)}`
        : "No tender data",
    },
    "win-rate-value": {
      percent: ratePercent(submittedShare?.winRateValue, resolvedCount > 0),
      detail: resolvedCount > 0 ? `${wonCount} of ${resolvedCount} resolved bids` : "No resolved bids yet",
    },
    "win-rate-count": {
      percent: ratePercent(resolvedCount > 0 ? wonCount / resolvedCount : null, resolvedCount > 0),
      detail: resolvedCount > 0 ? `${wonCount} of ${resolvedCount} resolved bids` : "No resolved bids yet",
    },
    "submission-rate": {
      percent: ratePercent(submittedShare?.submissionRate ?? null, totalTenders > 0),
      detail: totalTenders > 0 ? `of ${totalTenders} tenders on the register` : "No tenders yet",
    },
    "labour-utilisation": {
      percent: directorReading && scope.forecast ? labourUtilisationPercent(directorReading.forecastMatrix) : null,
      detail: directorReading?.forecastMatrix.length ? "Committed vs available, this block" : "No forecast yet",
    },
    "projects-on-track": {
      percent:
        directorReading && scope.projects
          ? projectsOnTrackPercent(directorReading.projects.map((p) => p.status))
          : null,
      detail: directorReading
        ? `${directorReading.projects.filter((p) => p.status === "On Track").length} of ${directorReading.projects.length} projects`
        : "No projects yet",
    },
    "compliance-current": {
      percent: complianceStatuses ? complianceCurrentPercent(complianceStatuses.map((c) => c.status)) : null,
      detail: complianceStatuses?.length
        ? `${complianceStatuses.filter((c) => c.status === "Valid").length} of ${complianceStatuses.length} documents valid`
        : "No compliance documents",
    },
  };

  const allowedSlots = availableKpiSlots(permissions);
  const slotLookup = new Map<KpiSlotId, KpiSlotMeta>(allowedSlots.map((s) => [s.id, s]));

  const rings: KpiRingData[] = resolveKpiSlots(
    savedRingSlots,
    allowedSlots.map((s) => s.id)
  ).map((id) => {
    const meta = slotLookup.get(id)!;
    const { percent, detail } = ringValues[id];
    return { id, title: meta.title, percent, band: bandFor(percent, good, warning), detail, explanation: meta.explanation };
  });

  const workerKpis: BarDatum[] = [];
  if (productivityRecords) {
    const attendance = attendancePercent(productivityRecords);
    const efficiency = labourEfficiencyPercent(productivityRecords);
    workerKpis.push(
      { label: "Attendance", percent: attendance, band: bandFor(attendance, good, warning), valueLabel: percentLabel(attendance) },
      { label: "Hours vs plan", percent: efficiency, band: bandFor(efficiency, good, warning), valueLabel: percentLabel(efficiency) }
    );
  }
  if (complianceStatuses) {
    const compliance = complianceCurrentPercent(complianceStatuses.map((c) => c.status));
    workerKpis.push({
      label: "Compliance current",
      percent: compliance,
      band: bandFor(compliance, good, warning),
      valueLabel: percentLabel(compliance),
    });
  }
  if (staffScores) {
    const overall = averageScore(staffScores.map((s) => s.overallScore));
    workerKpis.push({
      label: "Scorecard average",
      percent: overall,
      band: bandFor(overall, good, warning),
      valueLabel: percentLabel(overall),
    });
  }

  const roleScorecard: BarDatum[] = staffScores ? byTrade(staffScores, good, warning) : [];

  const capacity =
    directorReading && scope.forecast
      ? {
          ...directorReading.capacity,
          trades: tradeUtilisation(directorReading.forecastMatrix, directorReading.capacity.byRole),
        }
      : null;

  const dashboard: SimpleDashboard = {
    rings,
    projects: scope.projects && directorReading ? directorReading.projects : [],
    criticalDates: scope.projects && directorReading ? directorReading.criticalDates : [],
    capacity,
    alerts: directorReading ? directorReading.alerts.filter((a) => canSeeAlert(a, scope)) : [],
    checklist: buildChecklist(config.checklistItems, ticks, now),
    workerKpis,
    roleScorecard,
    pipeline:
      scope.tenders && directorReading
        ? {
            weightedPipeline: directorReading.pipeline.weightedPipeline,
            totalPipeline: directorReading.pipeline.totalPipeline,
            activeBids: directorReading.pipeline.activeBids,
            revenueWon: directorReading.pipeline.revenueWon,
          }
        : null,
    visibleWidgets: [],
  };

  dashboard.visibleWidgets = deriveVisibleWidgets(dashboard, scope);
  return dashboard;
}

function percentLabel(percent: Percent): string {
  return percent === null ? "No data" : `${Math.round(percent)}%`;
}

/** A shortage alert is a forecast reading; a compliance alert is a labour one. Neither should reach a user who can't open the page behind it. */
function canSeeAlert(alert: Alert, scope: Scope): boolean {
  return alert.type === "shortage" ? scope.forecast || scope.projects : scope.labour;
}

function byTrade(
  scores: { overallScore: number; worker: { capability: string } }[],
  good: number,
  warning: number
): BarDatum[] {
  const grouped = new Map<string, number[]>();
  for (const score of scores) {
    const existing = grouped.get(score.worker.capability);
    if (existing) existing.push(score.overallScore);
    else grouped.set(score.worker.capability, [score.overallScore]);
  }

  return Array.from(grouped.entries())
    .map(([trade, values]) => {
      const average = averageScore(values);
      return {
        label: trade,
        percent: average,
        band: bandFor(average, good, warning),
        valueLabel: `${percentLabel(average)} · ${values.length} assessed`,
      };
    })
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
}

/**
 * A widget only belongs on the page if this user can see its data AND there is
 * data to see. Hiding an empty card beats showing "No data" seven times — the
 * point of the simplified view is that what's on screen is worth reading.
 * The one exception is project health, which stays visible while empty because
 * "no projects yet" is itself the answer a new org needs.
 */
function deriveVisibleWidgets(dashboard: SimpleDashboard, scope: Scope): string[] {
  const widgets: string[] = [];
  if (dashboard.rings.length > 0) widgets.push("kpi-rings");
  if (scope.projects) widgets.push("project-health");
  if (dashboard.capacity) widgets.push("capacity");
  if (dashboard.alerts.length > 0) widgets.push("alerts");
  if (dashboard.checklist.length > 0) widgets.push("checklist");
  if (dashboard.workerKpis.length > 0) widgets.push("worker-kpis");
  if (dashboard.roleScorecard.length > 0) widgets.push("role-scorecard");
  if (dashboard.criticalDates.length > 0) widgets.push("critical-dates");
  if (dashboard.pipeline) widgets.push("pipeline");
  return widgets;
}
