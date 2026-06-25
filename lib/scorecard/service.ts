import { prisma } from "@/lib/prisma";
import { startOfMonth, addMonths } from "@/lib/dates";
import { auditLog } from "@/lib/audit";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { loadScorecardConfig } from "./config";
import { calcOverallScore, assertScoreEditable, type MetricScores } from "./calc";
import { getWorkerAutoMetrics } from "./productivity-service";
import { scaleRatioToScore } from "./productivity";
import type { MetricConfig } from "@/lib/validations/config";

/** The seeded default metric keys an AUTO source knows how to auto-fill. A custom AUTO metric with any other key falls back to 0 and must be entered manually. */
function autoFillValue(metric: MetricConfig, auto: { reliabilityPct: number | null; outputRatio: number | null }): number {
  if (metric.key === "reliability") return scaleRatioToScore(auto.reliabilityPct, metric.scaleMax);
  if (metric.key === "productivity") return scaleRatioToScore(auto.outputRatio, metric.scaleMax);
  return 0;
}

function buildAutoFilledScores(metrics: MetricConfig[], auto: { reliabilityPct: number | null; outputRatio: number | null }): MetricScores {
  return Object.fromEntries(
    metrics.map((m) => [m.key, m.source === "AUTO" ? autoFillValue(m, auto) : 0])
  );
}

/** Every key-staff worker with their score (if any) for the given month — the Scorecard page's main list. */
export async function listKeyStaffForPeriod(organisationId: string, monthDate: Date) {
  const period = startOfMonth(monthDate);
  const workers = await prisma.worker.findMany({
    where: { organisationId, isKeyStaff: true },
    orderBy: { name: "asc" },
    include: { staffScores: { where: { period } } },
  });

  return workers.map((worker) => ({
    worker: { id: worker.id, name: worker.name, capability: worker.capability, photoUrl: worker.photoUrl },
    score: worker.staffScores[0] ?? null,
  }));
}

/** Loads this month's score if it exists; otherwise builds (but does not persist) a draft with AUTO metrics pre-filled, ready for the assess form. */
export async function getOrCreateDraftScore(organisationId: string, workerId: string, monthDate: Date) {
  const period = startOfMonth(monthDate);
  const worker = await prisma.worker.findFirst({ where: { id: workerId, organisationId } });
  if (!worker) throw new NotFoundError("Worker not found");

  const existing = await prisma.staffScore.findUnique({ where: { organisationId_workerId_period: { organisationId, workerId, period } } });
  if (existing) return existing;

  const config = await loadScorecardConfig(organisationId);
  const auto = await getWorkerAutoMetrics(organisationId, workerId, period);
  const metricScores = buildAutoFilledScores(config.metrics, auto);

  return {
    id: null,
    organisationId,
    workerId,
    period,
    metricScoresJson: metricScores,
    overallScore: calcOverallScore(metricScores, config.metrics),
    assessedByUserId: null,
    lockedAt: null,
    note: null,
  };
}

/** Validates each provided score is a known metric key within [0, scaleMax]. */
function assertMetricScoresValid(scores: MetricScores, metrics: MetricConfig[]): void {
  const knownKeys = new Set(metrics.map((m) => m.key));
  for (const [key, value] of Object.entries(scores)) {
    if (!knownKeys.has(key)) throw new BadRequestError(`Unknown scorecard metric "${key}"`);
    const metric = metrics.find((m) => m.key === key)!;
    if (value < 0 || value > metric.scaleMax) {
      throw new BadRequestError(`Score for "${metric.label}" must be between 0 and ${metric.scaleMax}`);
    }
  }
}

export async function saveScore(
  organisationId: string,
  workerId: string,
  monthDate: Date,
  metricScores: MetricScores,
  userId: string,
  note?: string | null
) {
  const period = startOfMonth(monthDate);
  const worker = await prisma.worker.findFirst({ where: { id: workerId, organisationId } });
  if (!worker) throw new NotFoundError("Worker not found");

  const config = await loadScorecardConfig(organisationId);
  assertMetricScoresValid(metricScores, config.metrics);

  const existing = await prisma.staffScore.findUnique({ where: { organisationId_workerId_period: { organisationId, workerId, period } } });
  if (existing) assertScoreEditable(existing);

  const overallScore = calcOverallScore(metricScores, config.metrics);

  const score = await prisma.staffScore.upsert({
    where: { organisationId_workerId_period: { organisationId, workerId, period } },
    update: { metricScoresJson: metricScores, overallScore, assessedByUserId: userId, note: note ?? existing?.note ?? null },
    create: { organisationId, workerId, period, metricScoresJson: metricScores, overallScore, assessedByUserId: userId, note: note ?? null },
  });

  await auditLog({
    organisationId,
    userId,
    action: "scorecard.save",
    entityType: "StaffScore",
    entityId: score.id,
    before: existing?.metricScoresJson,
    after: { metricScoresJson: metricScores, overallScore },
  });

  return score;
}

export async function lockScore(organisationId: string, workerId: string, monthDate: Date, userId: string) {
  const period = startOfMonth(monthDate);
  const score = await prisma.staffScore.findUnique({ where: { organisationId_workerId_period: { organisationId, workerId, period } } });
  if (!score) throw new NotFoundError("No score recorded for this month yet");
  assertScoreEditable(score);

  const locked = await prisma.staffScore.update({ where: { id: score.id }, data: { lockedAt: new Date() } });

  await auditLog({ organisationId, userId, action: "scorecard.lock", entityType: "StaffScore", entityId: score.id });

  return locked;
}

export async function unlockScore(organisationId: string, workerId: string, monthDate: Date, userId: string) {
  const period = startOfMonth(monthDate);
  const score = await prisma.staffScore.findUnique({ where: { organisationId_workerId_period: { organisationId, workerId, period } } });
  if (!score) throw new NotFoundError("No score recorded for this month yet");

  const unlocked = await prisma.staffScore.update({ where: { id: score.id }, data: { lockedAt: null } });

  await auditLog({ organisationId, userId, action: "scorecard.unlock", entityType: "StaffScore", entityId: score.id });

  return unlocked;
}

/** Last 12 months of a worker's locked-or-not score history, oldest first — the trend chart on their scorecard. */
export async function getWorkerScoreHistory(organisationId: string, workerId: string, fromMonth: Date) {
  const from = startOfMonth(addMonths(fromMonth, -11));
  return prisma.staffScore.findMany({
    where: { organisationId, workerId, period: { gte: from } },
    orderBy: { period: "asc" },
  });
}
