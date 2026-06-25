import { describe, expect, it } from "vitest";
import {
  calcOutputRatio,
  calcReliabilityPct,
  allocatePlannedHoursShare,
  calcCostPerHour,
  scaleRatioToScore,
} from "@/lib/scorecard/productivity";

describe("calcOutputRatio", () => {
  it("is 1.0 when actual hours exactly match planned", () => {
    expect(calcOutputRatio(80, 80)).toBe(1);
  });

  it("is below 1.0 when under-delivering against the plan", () => {
    expect(calcOutputRatio(80, 40)).toBe(0.5);
  });

  it("is above 1.0 when over-delivering against the plan", () => {
    expect(calcOutputRatio(80, 100)).toBe(1.25);
  });

  it("is null when nothing was planned, instead of dividing by zero", () => {
    expect(calcOutputRatio(0, 40)).toBeNull();
  });
});

describe("calcReliabilityPct", () => {
  it("is 1.0 when present every expected day", () => {
    expect(calcReliabilityPct(20, 20)).toBe(1);
  });

  it("is a fraction when partially absent", () => {
    expect(calcReliabilityPct(15, 20)).toBe(0.75);
  });

  it("clamps to 1.0 even if presentDays somehow exceeds expectedDays", () => {
    expect(calcReliabilityPct(25, 20)).toBe(1);
  });

  it("is null when nobody was ever rostered, instead of reading as always-absent", () => {
    expect(calcReliabilityPct(0, 0)).toBeNull();
  });
});

describe("allocatePlannedHoursShare", () => {
  it("splits proportionally across trades", () => {
    const shares = allocatePlannedHoursShare({ Carpenter: 60, Electrician: 40 });
    expect(shares.Carpenter).toBe(0.6);
    expect(shares.Electrician).toBe(0.4);
  });

  it("gives every trade a 0 share when nothing was planned at all", () => {
    const shares = allocatePlannedHoursShare({ Carpenter: 0, Electrician: 0 });
    expect(shares.Carpenter).toBe(0);
    expect(shares.Electrician).toBe(0);
  });

  it("handles a single trade as 100% of the share", () => {
    const shares = allocatePlannedHoursShare({ Carpenter: 50 });
    expect(shares.Carpenter).toBe(1);
  });
});

describe("calcCostPerHour", () => {
  it("allocates project value by planned-hours share, divided by actual hours", () => {
    // $1,000,000 project, this trade is 40% of planned hours, 200 actual hours worked.
    // -> $400,000 allocated / 200 hours = $2,000/hr.
    expect(calcCostPerHour(1_000_000, 0.4, 200)).toBe(2_000);
  });

  it("is null when no hours were actually worked, instead of dividing by zero", () => {
    expect(calcCostPerHour(1_000_000, 0.4, 0)).toBeNull();
  });

  it("is null when the trade had no planned-hours share at all", () => {
    expect(calcCostPerHour(1_000_000, 0, 200)).toBeNull();
  });
});

describe("scaleRatioToScore", () => {
  it("maps a ratio of 1.0 (on target) to the full scale", () => {
    expect(scaleRatioToScore(1, 5)).toBe(5);
  });

  it("maps a ratio of 0.5 to half the scale", () => {
    expect(scaleRatioToScore(0.5, 5)).toBe(2.5);
  });

  it("caps an over-target ratio at the scale max rather than exceeding it", () => {
    expect(scaleRatioToScore(1.5, 5)).toBe(5);
  });

  it("scores 0 when there's no data yet, rather than assuming a default", () => {
    expect(scaleRatioToScore(null, 5)).toBe(0);
  });
});
