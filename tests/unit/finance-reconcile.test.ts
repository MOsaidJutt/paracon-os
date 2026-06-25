import { describe, expect, it } from "vitest";
import { reconcilePoAgainstBills } from "@/lib/finance/reconcile";

describe("reconcilePoAgainstBills", () => {
  it("reports no variance when billed exactly matches the PO value", () => {
    const result = reconcilePoAgainstBills(22_000, [22_000], 5);
    expect(result.totalBilled).toBe(22_000);
    expect(result.variance).toBe(0);
    expect(result.overBudget).toBe(false);
  });

  it("sums multiple bills against a single PO", () => {
    const result = reconcilePoAgainstBills(50_000, [20_000, 25_000], 5);
    expect(result.totalBilled).toBe(45_000);
    expect(result.variance).toBe(-5_000);
    expect(result.overBudget).toBe(false);
  });

  it("flags over budget once the variance exceeds the configured tolerance", () => {
    // $65,000 PO billed at $70,000 -> +7.7% variance, tolerance 5%
    const result = reconcilePoAgainstBills(65_000, [70_000], 5);
    expect(result.variancePct).toBeCloseTo(7.69, 1);
    expect(result.overBudget).toBe(true);
  });

  it("stays within tolerance for a small variance", () => {
    const result = reconcilePoAgainstBills(65_000, [66_500], 5);
    expect(result.variancePct).toBeCloseTo(2.31, 1);
    expect(result.overBudget).toBe(false);
  });

  it("treats any billed amount against a zero-value PO as over budget", () => {
    const result = reconcilePoAgainstBills(0, [1_000], 5);
    expect(result.variancePct).toBe(100);
    expect(result.overBudget).toBe(true);
  });

  it("handles a PO with no bills against it yet", () => {
    const result = reconcilePoAgainstBills(10_000, [], 5);
    expect(result.totalBilled).toBe(0);
    expect(result.overBudget).toBe(false);
  });
});
