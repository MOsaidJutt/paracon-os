import { describe, expect, it } from "vitest";
import { calcVariationTotals } from "@/lib/documents/variation-calc";

describe("calcVariationTotals", () => {
  it("matches the real Variation_Template_R2.xlsx example (1 item, $1,350, 10% GST)", () => {
    const result = calcVariationTotals([{ item: 1, description: "Extend plaster lining", amount: 1350 }], 10);
    expect(result.totalExGst).toBe(1350);
    expect(result.gst).toBe(135);
    expect(result.totalIncGst).toBe(1485);
  });

  it("sums multiple line items", () => {
    const result = calcVariationTotals(
      [
        { item: 1, description: "A", amount: 500 },
        { item: 2, description: "B", amount: 250.5 },
      ],
      10
    );
    expect(result.totalExGst).toBe(750.5);
  });

  it("rounds to the cent on a GST rate that produces a fractional cent", () => {
    const result = calcVariationTotals([{ item: 1, description: "A", amount: 99.99 }], 10);
    expect(result.gst).toBe(10);
    expect(result.totalIncGst).toBe(109.99);
  });

  it("respects a config-driven GST rate other than 10%", () => {
    const result = calcVariationTotals([{ item: 1, description: "A", amount: 1000 }], 15);
    expect(result.gst).toBe(150);
    expect(result.totalIncGst).toBe(1150);
  });

  it("handles zero line items", () => {
    const result = calcVariationTotals([], 10);
    expect(result).toEqual({ totalExGst: 0, gst: 0, totalIncGst: 0 });
  });
});
