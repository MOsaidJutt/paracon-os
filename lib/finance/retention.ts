import { round2 } from "@/lib/documents/money";

/**
 * Standard AS2124/AS4000-style retention scheme (the contract terms confirmed
 * for this build: 10% withheld per claim, capped at 5% of contract value,
 * with half the cap — 2.5% — released at Practical Completion and the
 * remaining 2.5% at the final/defects-liability release).
 *
 * Withholds `ratePct` of this claim, but never lets cumulative retention held
 * exceed `capPct` of the contract value — the last claim before the cap is
 * reached withholds only the remainder needed to hit the cap exactly.
 */
export function calcRetentionForClaim(input: {
  claimAmountExGst: number;
  cumulativeRetentionHeldBefore: number;
  contractValue: number;
  ratePct: number;
  capPct: number;
}): { retentionThisClaim: number; cumulativeRetentionHeldAfter: number } {
  const capAmount = round2(input.contractValue * (input.capPct / 100));
  const headroom = Math.max(0, capAmount - input.cumulativeRetentionHeldBefore);
  const uncapped = round2(input.claimAmountExGst * (input.ratePct / 100));
  const retentionThisClaim = Math.min(uncapped, headroom);
  return {
    retentionThisClaim,
    cumulativeRetentionHeldAfter: round2(input.cumulativeRetentionHeldBefore + retentionThisClaim),
  };
}

/** Amount released at Practical Completion — `pcReleaseFractionPct` of the retention held to date. */
export function calcPracticalCompletionRelease(retentionHeldToDate: number, pcReleaseFractionPct: number): number {
  return round2(retentionHeldToDate * (pcReleaseFractionPct / 100));
}

/** Retention currently held = every claim's withheld amount minus every release recorded against the project. */
export function calcRetentionHeldToDate(claimRetentions: number[], releaseAmounts: number[]): number {
  const held = claimRetentions.reduce((sum, v) => sum + v, 0);
  const released = releaseAmounts.reduce((sum, v) => sum + v, 0);
  return round2(Math.max(0, held - released));
}
