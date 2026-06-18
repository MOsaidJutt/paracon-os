import type { ValueBand } from "./config";

// Mirrors the formulas baked into the client's "v9 - Tender Tracker.xlsx" Dashboard sheet
// (SUMPRODUCT/COUNTIFS/SUMIFS over the Tender Register), so importing that file and reading
// this dashboard reproduces the same figures within rounding.

export type CalcTender = {
  id: string;
  clientId: string;
  status: string;
  value: number;
  winProbabilityNumeric: number;
  outcome: string | null;
  winningBid: number | null;
  valueBand: string;
  received: Date | null;
  due: Date | null;
  submitted: Date | null;
  tenderDurationDays: number | null;
};

/**
 * Statuses still "in flight" (not yet won/lost/withdrawn) are derived from the
 * Config-driven status weights rather than a hardcoded status name list, so
 * an admin renaming/adding a status keeps Active Bids / Total Pipeline correct
 * without a code change. A weight of exactly 0 or 1 is treated as resolved.
 */
export function activeStatusesFromWeights(statusWeights: Record<string, number>): string[] {
  return Object.entries(statusWeights)
    .filter(([, weight]) => weight > 0 && weight < 1)
    .map(([status]) => status);
}

function isActive(tender: CalcTender, activeStatuses: string[]): boolean {
  return activeStatuses.includes(tender.status);
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

export type PipelineSummary = {
  weightedPipeline: number;
  totalPipeline: number;
  activeBids: number;
  winRateCount: number;
  winRateValue: number;
  submissionRate: number;
  revenueWon: number;
  avgBidValue: number;
};

export function calcPipelineSummary(tenders: CalcTender[], activeStatuses: string[]): PipelineSummary {
  const wonCount = tenders.filter((t) => t.outcome === "Won").length;
  const lostCount = tenders.filter((t) => t.outcome === "Lost").length;
  const submittedCount = tenders.filter((t) => t.status === "Submitted").length;
  const resolvedValueSum = tenders
    .filter((t) => t.outcome === "Won" || t.outcome === "Lost")
    .reduce((sum, t) => sum + t.value, 0);

  return {
    weightedPipeline: tenders.reduce((sum, t) => sum + t.value * t.winProbabilityNumeric, 0),
    totalPipeline: tenders.filter((t) => isActive(t, activeStatuses)).reduce((sum, t) => sum + t.value, 0),
    activeBids: tenders.filter((t) => isActive(t, activeStatuses)).length,
    winRateCount: safeDivide(wonCount, wonCount + lostCount),
    winRateValue: safeDivide(
      tenders.filter((t) => t.outcome === "Won").reduce((sum, t) => sum + (t.winningBid ?? 0), 0),
      resolvedValueSum
    ),
    submissionRate: safeDivide(submittedCount, tenders.length),
    revenueWon: tenders.filter((t) => t.outcome === "Won").reduce((sum, t) => sum + (t.winningBid ?? 0), 0),
    avgBidValue: average(tenders.filter((t) => t.value > 0).map((t) => t.value)),
  };
}

export type BidSizeBandRow = {
  label: string;
  totalBids: number;
  wins: number;
  winRateCount: number;
  winRateValue: number;
  revenueWon: number;
  avgBidValue: number;
  pipelineValue: number;
};

export function calcBidSizeBands(
  tenders: CalcTender[],
  bands: ValueBand[],
  activeStatuses: string[]
): BidSizeBandRow[] {
  return bands.map((band) => {
    const inBand = tenders.filter((t) => t.valueBand === band.label);
    const wins = inBand.filter((t) => t.outcome === "Won");
    const losses = inBand.filter((t) => t.outcome === "Lost");
    const resolvedValueSum = wins.reduce((sum, t) => sum + t.value, 0) + losses.reduce((sum, t) => sum + t.value, 0);

    return {
      label: band.label,
      totalBids: inBand.length,
      wins: wins.length,
      winRateCount: safeDivide(wins.length, wins.length + losses.length),
      winRateValue: safeDivide(wins.reduce((sum, t) => sum + (t.winningBid ?? 0), 0), resolvedValueSum),
      revenueWon: wins.reduce((sum, t) => sum + (t.winningBid ?? 0), 0),
      avgBidValue: average(inBand.filter((t) => t.value > 0).map((t) => t.value)),
      pipelineValue: inBand.filter((t) => isActive(t, activeStatuses)).reduce((sum, t) => sum + t.value, 0),
    };
  });
}

export type TenderTiming = {
  avgDurationDays: number | null;
  lateSubmissionRate: number;
  rushTenderRate: number;
  onTimeSubmissionRate: number;
  dueThisWeek: number;
  overdue: number;
};

export function calcTenderTiming(
  tenders: CalcTender[],
  activeStatuses: string[],
  today: Date = new Date()
): TenderTiming {
  const withDuration = tenders.filter((t) => (t.tenderDurationDays ?? -1) > 0);
  const submittedWithDue = tenders.filter((t) => t.submitted && t.due);
  const lateCount = submittedWithDue.filter((t) => t.submitted! > t.due!).length;
  const onTimeCount = submittedWithDue.filter((t) => t.submitted! <= t.due!).length;
  const weekFromNow = new Date(today.getTime() + 7 * 86_400_000);

  // "Due this week" / "Overdue" only apply to tenders still in flight that
  // haven't been submitted yet — a withdrawn/won/lost tender's due date is no
  // longer a live risk, even if it was never formally "submitted".
  const notYetSubmitted = tenders.filter((t) => !t.submitted && t.due && isActive(t, activeStatuses));

  return {
    avgDurationDays: withDuration.length === 0 ? null : average(withDuration.map((t) => t.tenderDurationDays!)),
    lateSubmissionRate: safeDivide(lateCount, submittedWithDue.length),
    rushTenderRate: safeDivide(withDuration.filter((t) => t.tenderDurationDays! < 3).length, withDuration.length),
    onTimeSubmissionRate: safeDivide(onTimeCount, submittedWithDue.length),
    dueThisWeek: notYetSubmitted.filter((t) => t.due! >= today && t.due! < weekFromNow).length,
    overdue: notYetSubmitted.filter((t) => t.due! < today).length,
  };
}

export type ClientScorecardRow = {
  clientId: string;
  bidCount: number;
  wins: number;
  winRate: number;
  avgJobValue: number;
  totalWonValue: number;
  pipelineValue: number;
  score: number;
};

export function calcClientScorecard(tenders: CalcTender[], activeStatuses: string[]): ClientScorecardRow[] {
  const clientIds = Array.from(new Set(tenders.map((t) => t.clientId)));

  return clientIds.map((clientId) => {
    const clientTenders = tenders.filter((t) => t.clientId === clientId);
    const wins = clientTenders.filter((t) => t.outcome === "Won");
    const losses = clientTenders.filter((t) => t.outcome === "Lost");
    const winRate = safeDivide(wins.length, wins.length + losses.length);
    const avgJobValue = average(clientTenders.filter((t) => t.value > 0).map((t) => t.value));

    return {
      clientId,
      bidCount: clientTenders.length,
      wins: wins.length,
      winRate,
      avgJobValue,
      totalWonValue: wins.reduce((sum, t) => sum + (t.winningBid ?? 0), 0),
      pipelineValue: clientTenders.filter((t) => isActive(t, activeStatuses)).reduce((sum, t) => sum + t.value, 0),
      score: winRate * avgJobValue * clientTenders.length,
    };
  });
}
