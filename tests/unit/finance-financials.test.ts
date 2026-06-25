import { describe, expect, it } from "vitest";
import { calcProjectFinancials } from "@/lib/finance/financials";

const BASE = {
  contractValueBase: 850_000,
  approvedVariationsValue: 18_500,
  costBudget: 740_000 as number | null,
  committedCost: 87_000,
  actualCost: 34_000,
  claimedToDate: 340_000,
  certifiedToDate: 340_000,
  paidToDate: 0,
  retentionHeldToDate: 34_000,
};

describe("calcProjectFinancials", () => {
  it("derives contract value as base + approved variations", () => {
    const result = calcProjectFinancials(BASE);
    expect(result.contractValue).toBe(868_500);
  });

  it("computes planned margin from contract value vs cost budget", () => {
    const result = calcProjectFinancials(BASE);
    // (868,500 - 740,000) / 868,500 = ~14.8%
    expect(result.marginPlannedPct).toBeCloseTo(14.8, 1);
  });

  it("returns null planned margin when no cost budget has been set yet", () => {
    const result = calcProjectFinancials({ ...BASE, costBudget: null });
    expect(result.marginPlannedPct).toBeNull();
  });

  it("computes margin-to-date from claimed vs actual cost", () => {
    const result = calcProjectFinancials(BASE);
    // (340,000 - 34,000) / 340,000 = 90%
    expect(result.marginToDatePct).toBeCloseTo(90, 1);
  });

  it("returns null margin-to-date before anything has been claimed", () => {
    const result = calcProjectFinancials({ ...BASE, claimedToDate: 0 });
    expect(result.marginToDatePct).toBeNull();
  });

  it("handles a project with no variations or committed cost yet", () => {
    const result = calcProjectFinancials({
      contractValueBase: 500_000,
      approvedVariationsValue: 0,
      costBudget: null,
      committedCost: 0,
      actualCost: 0,
      claimedToDate: 0,
      certifiedToDate: 0,
      paidToDate: 0,
      retentionHeldToDate: 0,
    });
    expect(result.contractValue).toBe(500_000);
    expect(result.marginPlannedPct).toBeNull();
    expect(result.marginToDatePct).toBeNull();
  });
});
