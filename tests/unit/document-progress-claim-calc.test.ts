import { describe, expect, it } from "vitest";
import {
  calcProgressClaimLine,
  calcProgressClaimTotals,
  sumProgressClaimLines,
} from "@/lib/documents/progress-claim-calc";

describe("calcProgressClaimLine", () => {
  it("matches the real Invoice Proforma Template.xlsx example (0% complete -> $0 claimed)", () => {
    const result = calcProgressClaimLine({
      name: "Partitions",
      percentCompleted: 0,
      contractValue: 271_916.67,
      previouslyClaimed: 0,
    });
    expect(result.valueToBeInvoiced).toBe(0);
    expect(result.thisClaim).toBe(0);
  });

  it("computes Value To Be Invoiced as Contract Value x %Completed", () => {
    const result = calcProgressClaimLine({
      name: "Partitions",
      percentCompleted: 40,
      contractValue: 271_916.67,
      previouslyClaimed: 0,
    });
    expect(result.valueToBeInvoiced).toBe(108_766.67);
    expect(result.thisClaim).toBe(108_766.67);
  });

  it("subtracts Previously Claimed to get This Claim", () => {
    const result = calcProgressClaimLine({
      name: "Partitions",
      percentCompleted: 60,
      contractValue: 271_916.67,
      previouslyClaimed: 108_766.67,
    });
    expect(result.valueToBeInvoiced).toBe(163_150);
    expect(result.thisClaim).toBe(54_383.33);
  });
});

describe("Previously Claimed carry-forward across sequential claims", () => {
  // Mirrors how lib/documents/generation-service.ts reads the prior
  // GeneratedDocument's valueToBeInvoiced for the same line as this claim's
  // previouslyClaimed input — never re-typed by the PM.
  it("carries forward across 3 sequential claims on the same trade line", () => {
    const contractValue = 200_000;

    const claim1 = calcProgressClaimLine({ name: "Doors", percentCompleted: 20, contractValue, previouslyClaimed: 0 });
    expect(claim1.valueToBeInvoiced).toBe(40_000);
    expect(claim1.thisClaim).toBe(40_000);

    const claim2 = calcProgressClaimLine({
      name: "Doors",
      percentCompleted: 55,
      contractValue,
      previouslyClaimed: claim1.valueToBeInvoiced,
    });
    expect(claim2.valueToBeInvoiced).toBe(110_000);
    expect(claim2.thisClaim).toBe(70_000);

    const claim3 = calcProgressClaimLine({
      name: "Doors",
      percentCompleted: 100,
      contractValue,
      previouslyClaimed: claim2.valueToBeInvoiced,
    });
    expect(claim3.valueToBeInvoiced).toBe(200_000);
    expect(claim3.thisClaim).toBe(90_000);
  });

  it("a brand-new trade line not present on any prior claim starts at previouslyClaimed = 0", () => {
    const claim = calcProgressClaimLine({ name: "New scope item", percentCompleted: 10, contractValue: 50_000, previouslyClaimed: 0 });
    expect(claim.thisClaim).toBe(claim.valueToBeInvoiced);
  });
});

describe("sumProgressClaimLines", () => {
  it("sums every column across lines", () => {
    const lines = [
      calcProgressClaimLine({ name: "Partitions", percentCompleted: 50, contractValue: 271_916.67, previouslyClaimed: 0 }),
      calcProgressClaimLine({ name: "Doors", percentCompleted: 50, contractValue: 55_916.67, previouslyClaimed: 0 }),
      calcProgressClaimLine({ name: "Ceiling", percentCompleted: 50, contractValue: 90_416.63, previouslyClaimed: 0 }),
    ];
    const subtotal = sumProgressClaimLines(lines);
    expect(subtotal.contractValue).toBe(418_249.97);
    expect(subtotal.thisClaim).toBe(209_125);
  });
});

describe("calcProgressClaimTotals", () => {
  it("combines CONTRACT WORK + VARIATIONS sections, GST applied to the combined This Claim subtotal", () => {
    const contractWork = [
      calcProgressClaimLine({ name: "Partitions", percentCompleted: 50, contractValue: 271_916.67, previouslyClaimed: 0 }),
      calcProgressClaimLine({ name: "Doors", percentCompleted: 50, contractValue: 55_916.67, previouslyClaimed: 0 }),
      calcProgressClaimLine({ name: "Ceiling", percentCompleted: 50, contractValue: 90_416.63, previouslyClaimed: 0 }),
    ];
    const variations = [calcProgressClaimLine({ name: "VQ-01", percentCompleted: 100, contractValue: 1350, previouslyClaimed: 0 })];

    const totals = calcProgressClaimTotals(contractWork, variations, 10);
    expect(totals.subtotalExGst).toBe(210_475);
    expect(totals.gst).toBe(21_047.5);
    expect(totals.totalIncGst).toBe(231_522.5);
  });

  it("returns zero totals when there are no lines yet", () => {
    const totals = calcProgressClaimTotals([], [], 10);
    expect(totals.subtotalExGst).toBe(0);
    expect(totals.gst).toBe(0);
    expect(totals.totalIncGst).toBe(0);
  });
});
