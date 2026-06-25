import { describe, expect, it } from "vitest";
import { applyMargin, calcTenderPrice } from "@/lib/documents/tender-letter-calc";

describe("applyMargin", () => {
  it("MARGIN_ON_SELL: margin as a % of the sell price (sell = cost / (1 - margin%))", () => {
    expect(applyMargin(100_000, 6, "MARGIN_ON_SELL")).toBe(106_382.98);
  });

  it("MARKUP_ON_COST: margin as a % markup on cost (sell = cost * (1 + margin%))", () => {
    expect(applyMargin(100_000, 6, "MARKUP_ON_COST")).toBe(106_000);
  });

  it("a zero-cost trade produces a zero sell amount under either formula", () => {
    expect(applyMargin(0, 6, "MARGIN_ON_SELL")).toBe(0);
    expect(applyMargin(0, 6, "MARKUP_ON_COST")).toBe(0);
  });
});

const TRADE_LINES = [
  { name: "Partitions", costAmount: 480_000 },
  { name: "Doors", costAmount: 120_000 },
  { name: "Ceiling", costAmount: 90_000 },
];

describe("calcTenderPrice — EX_GST rounding basis (Paracon's default SOP)", () => {
  it("rounds the ex-GST subtotal UP to the next $10,000 before deriving GST/total", () => {
    const result = calcTenderPrice(TRADE_LINES, 6, "MARGIN_ON_SELL", "EX_GST", 10_000, 10);
    expect(result.subtotalExGst).toBe(740_000);
    expect(result.gst).toBe(74_000);
    expect(result.totalIncGst).toBe(814_000);
  });

  it("an ex-GST subtotal that lands exactly on a $10,000 multiple is left unchanged", () => {
    const result = calcTenderPrice([{ name: "Partitions", costAmount: 470_000 }], 0, "MARKUP_ON_COST", "EX_GST", 10_000, 10);
    expect(result.subtotalExGst).toBe(470_000);
  });

  it("rounds a subtotal just $1 over a multiple up to the next whole increment", () => {
    const result = calcTenderPrice([{ name: "Partitions", costAmount: 470_000.5 }], 0, "MARKUP_ON_COST", "EX_GST", 10_000, 10);
    expect(result.subtotalExGst).toBe(480_000);
  });

  it("a zero-cost trade line contributes nothing to the subtotal", () => {
    const result = calcTenderPrice([{ name: "Partitions", costAmount: 0 }], 6, "MARGIN_ON_SELL", "EX_GST", 10_000, 10);
    expect(result.subtotalExGst).toBe(0);
    expect(result.totalIncGst).toBe(0);
  });

  it("the rounding increment is config-driven, not fixed to $10,000", () => {
    const result = calcTenderPrice([{ name: "Partitions", costAmount: 470_500 }], 0, "MARKUP_ON_COST", "EX_GST", 1_000, 10);
    expect(result.subtotalExGst).toBe(471_000);
  });
});

describe("calcTenderPrice — INC_GST rounding basis", () => {
  it("rounds the GST-inclusive total up, then backs out the ex-GST subtotal and GST from it", () => {
    const result = calcTenderPrice(TRADE_LINES, 6, "MARGIN_ON_SELL", "INC_GST", 10_000, 10);
    expect(result.totalIncGst).toBe(810_000);
    expect(result.subtotalExGst).toBe(736_363.64);
    expect(result.gst).toBe(73_636.36);
  });
});
