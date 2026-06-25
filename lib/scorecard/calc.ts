import { BadRequestError } from "@/lib/errors";
import { round2 } from "@/lib/documents/money";
import type { MetricConfig } from "@/lib/validations/config";

export type MetricScores = Record<string, number>;

/**
 * Weighted overall score, normalised to 0-100 regardless of how the admin's
 * weights sum (no requirement they total 1) — each metric's raw score is
 * scaled to a 0-1 fraction of its own scaleMax before weighting, so metrics
 * with different scales (e.g. a 0-5 Quality vs a 0-10 Productivity) combine
 * fairly. A metric missing from `scores` contributes 0, not a skipped weight.
 */
export function calcOverallScore(scores: MetricScores, metrics: MetricConfig[]): number {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight <= 0) return 0;

  const weightedFraction = metrics.reduce((sum, m) => {
    const raw = scores[m.key] ?? 0;
    const fraction = m.scaleMax > 0 ? clamp(raw / m.scaleMax, 0, 1) : 0;
    return sum + fraction * m.weight;
  }, 0);

  return round2((weightedFraction / totalWeight) * 100);
}

/** Throws if a StaffScore's period is already locked — the monthly-lock guard every save/delete path must call first. */
export function assertScoreEditable(score: { lockedAt: Date | null }): void {
  if (score.lockedAt) {
    throw new BadRequestError("This month's score is locked and can no longer be edited. Unlock it first.");
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
