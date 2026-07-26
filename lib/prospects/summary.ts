/**
 * The figures on the Prospects summary strip.
 *
 * Pure, so the arithmetic is unit-testable without a database, and so the one
 * definition of "converted" lives in a single place rather than being counted
 * slightly differently by the ring and by the lanes.
 *
 * A prospect is CONVERTED when it carries a convertedTenderId. That is a
 * derived state, not a stage: the stage list is admin-editable config, and
 * "converted" must not depend on someone naming a stage the right thing.
 */
export type ProspectSummaryInput = {
  stage: string;
  estimatedValue: number | null;
  probability: number | null;
  convertedTenderId: string | null;
};

export type StageSummary = {
  stage: string;
  count: number;
  value: number;
};

export type ProspectSummary = {
  total: number;
  converted: number;
  /** Converted as a percentage of every prospect ever raised. null when there are none — a new org has an unknown rate, not a 0% one. */
  conversionPercent: number | null;
  /** Per-stage counts and value, in the order the stage list declares. Converted prospects are excluded: they've left the pipeline. */
  byStage: StageSummary[];
  /** Estimated value of everything still open. */
  openValue: number;
  /** Open value weighted by each lead's own probability. A lead with no probability set contributes nothing rather than its full value. */
  weightedValue: number;
};

export function summariseProspects(prospects: ProspectSummaryInput[], stageList: string[]): ProspectSummary {
  const converted = prospects.filter((p) => p.convertedTenderId !== null);
  const open = prospects.filter((p) => p.convertedTenderId === null);

  const byStage = stageList.map((stage) => {
    const inStage = open.filter((p) => p.stage === stage);
    return {
      stage,
      count: inStage.length,
      value: inStage.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    };
  });

  return {
    total: prospects.length,
    converted: converted.length,
    conversionPercent: prospects.length === 0 ? null : (converted.length / prospects.length) * 100,
    byStage,
    openValue: open.reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    weightedValue: open.reduce((sum, p) => sum + (p.estimatedValue ?? 0) * ((p.probability ?? 0) / 100), 0),
  };
}

/**
 * Whether a lead's next action is overdue, due today, or still ahead — the
 * signal that makes the board chase work rather than just list it. Compared by
 * calendar day, so an action due "today" doesn't read as overdue purely
 * because the morning has passed.
 */
export type NextActionState = "none" | "overdue" | "today" | "upcoming";

export function nextActionState(nextActionDate: Date | string | null, now: Date = new Date()): NextActionState {
  if (!nextActionDate) return "none";

  const due = typeof nextActionDate === "string" ? new Date(nextActionDate) : nextActionDate;
  if (Number.isNaN(due.getTime())) return "none";

  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  if (dueDay < today) return "overdue";
  if (dueDay === today) return "today";
  return "upcoming";
}
