import { describe, expect, it } from "vitest";
import { calcPracticalCompletionRelease, calcRetentionForClaim, calcRetentionHeldToDate } from "@/lib/finance/retention";

describe("calcRetentionForClaim", () => {
  it("withholds 10% of the claim when well under the 5% cap", () => {
    const result = calcRetentionForClaim({
      claimAmountExGst: 100_000,
      cumulativeRetentionHeldBefore: 0,
      contractValue: 1_000_000,
      ratePct: 10,
      capPct: 5,
    });
    expect(result.retentionThisClaim).toBe(10_000);
    expect(result.cumulativeRetentionHeldAfter).toBe(10_000);
  });

  it("clamps to exactly the cap when the uncapped withholding would exceed it", () => {
    // Cap = 5% of $1m = $50,000. Already held $45,000. This claim's 10% would be $20,000, but only $5,000 of headroom remains.
    const result = calcRetentionForClaim({
      claimAmountExGst: 200_000,
      cumulativeRetentionHeldBefore: 45_000,
      contractValue: 1_000_000,
      ratePct: 10,
      capPct: 5,
    });
    expect(result.retentionThisClaim).toBe(5_000);
    expect(result.cumulativeRetentionHeldAfter).toBe(50_000);
  });

  it("withholds nothing once the cap has already been reached", () => {
    const result = calcRetentionForClaim({
      claimAmountExGst: 50_000,
      cumulativeRetentionHeldBefore: 50_000,
      contractValue: 1_000_000,
      ratePct: 10,
      capPct: 5,
    });
    expect(result.retentionThisClaim).toBe(0);
    expect(result.cumulativeRetentionHeldAfter).toBe(50_000);
  });
});

describe("calcPracticalCompletionRelease", () => {
  it("releases half the retention held at PC, leaving the other half for the final release", () => {
    expect(calcPracticalCompletionRelease(50_000, 50)).toBe(25_000);
  });

  it("releases the full amount when the fraction is 100%", () => {
    expect(calcPracticalCompletionRelease(20_000, 100)).toBe(20_000);
  });
});

describe("calcRetentionHeldToDate", () => {
  it("sums claim retentions minus releases", () => {
    expect(calcRetentionHeldToDate([10_000, 15_000, 25_000], [20_000])).toBe(30_000);
  });

  it("never goes negative even if releases somehow exceed what's held", () => {
    expect(calcRetentionHeldToDate([10_000], [15_000])).toBe(0);
  });

  it("returns 0 with no claims or releases", () => {
    expect(calcRetentionHeldToDate([], [])).toBe(0);
  });
});
