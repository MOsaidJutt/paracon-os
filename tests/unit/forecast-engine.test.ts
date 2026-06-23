import { describe, expect, it } from "vitest";
import {
  aggregateWeightedPipelineDemand,
  buildBlocks,
  buildForecastMatrix,
  buildHeatmap,
  classifyRag,
  computeGap,
  computeHeadroom,
  computeWeeklySupply,
  mergeWeeklyMaps,
  type PipelineTenderForDemand,
  type WeeklyMap,
  type WorkerForSupply,
} from "@/lib/forecast/engine";

const BASE = Date.UTC(2026, 0, 5); // Monday, 5 Jan 2026
const day = (n: number) => new Date(BASE + n * 86_400_000);

const THRESHOLDS = { green: 1.0, amber: 0.85, red: 0.7 };

describe("mergeWeeklyMaps", () => {
  it("sums role counts across maps, week by week", () => {
    const a: WeeklyMap = { "2026-01-05": { Carpenter: 2 } };
    const b: WeeklyMap = { "2026-01-05": { Carpenter: 1, Plumber: 1 }, "2026-01-12": { Plumber: 1 } };
    expect(mergeWeeklyMaps(a, b)).toEqual({
      "2026-01-05": { Carpenter: 3, Plumber: 1 },
      "2026-01-12": { Plumber: 1 },
    });
  });

  it("returns an empty map when given no sources", () => {
    expect(mergeWeeklyMaps()).toEqual({});
  });
});

describe("aggregateWeightedPipelineDemand", () => {
  it("weights each role's headcount by win probability", () => {
    const tenders: PipelineTenderForDemand[] = [
      { expectedStart: day(0), expectedEnd: day(0), expectedLabour: { Carpenter: 2 }, winProbabilityNumeric: 0.5 },
    ];
    const demand = aggregateWeightedPipelineDemand(tenders);
    expect(demand["2026-01-05"]).toEqual({ Carpenter: 1 });
  });

  it("spreads demand across every week the expected window spans", () => {
    const tenders: PipelineTenderForDemand[] = [
      { expectedStart: day(0), expectedEnd: day(13), expectedLabour: { Plumber: 1 }, winProbabilityNumeric: 1 },
    ];
    const demand = aggregateWeightedPipelineDemand(tenders);
    expect(Object.keys(demand).sort()).toEqual(["2026-01-05", "2026-01-12"]);
  });

  it("ignores tenders missing expectedStart, expectedEnd or expectedLabour", () => {
    const tenders: PipelineTenderForDemand[] = [
      { expectedStart: null, expectedEnd: day(7), expectedLabour: { Carpenter: 1 }, winProbabilityNumeric: 1 },
      { expectedStart: day(0), expectedEnd: null, expectedLabour: { Carpenter: 1 }, winProbabilityNumeric: 1 },
      { expectedStart: day(0), expectedEnd: day(7), expectedLabour: null, winProbabilityNumeric: 1 },
    ];
    expect(aggregateWeightedPipelineDemand(tenders)).toEqual({});
  });

  it("combines multiple tenders landing in the same week", () => {
    const tenders: PipelineTenderForDemand[] = [
      { expectedStart: day(0), expectedEnd: day(0), expectedLabour: { Carpenter: 2 }, winProbabilityNumeric: 0.8 },
      { expectedStart: day(0), expectedEnd: day(0), expectedLabour: { Carpenter: 1 }, winProbabilityNumeric: 0.2 },
    ];
    const demand = aggregateWeightedPipelineDemand(tenders);
    expect(demand["2026-01-05"].Carpenter).toBeCloseTo(1.8);
  });
});

describe("computeWeeklySupply", () => {
  const weeks = [day(0), day(7), day(14)]; // 3 ISO weeks

  it("counts only workers with the matching status, grouped by capability", () => {
    const workers: WorkerForSupply[] = [
      { capability: "Carpenter", status: "Available", leave: [] },
      { capability: "Carpenter", status: "Assigned", leave: [] },
      { capability: "Plumber", status: "Available", leave: [] },
    ];
    const supply = computeWeeklySupply(workers, weeks);
    expect(supply["2026-01-05"]).toEqual({ Carpenter: 1, Plumber: 1 });
  });

  it("nets a worker out of only the weeks their leave overlaps", () => {
    const workers: WorkerForSupply[] = [
      { capability: "Carpenter", status: "Available", leave: [{ startDate: day(7), endDate: day(10) }] },
    ];
    const supply = computeWeeklySupply(workers, weeks);
    expect(supply["2026-01-05"]?.Carpenter ?? 0).toBe(1); // week 1: not on leave
    expect(supply["2026-01-12"]?.Carpenter ?? 0).toBe(0); // week 2: leave overlaps
    expect(supply["2026-01-19"]?.Carpenter ?? 0).toBe(1); // week 3: leave already ended
  });

  it("returns an empty map when there are no workers (the no-supply edge case)", () => {
    expect(computeWeeklySupply([], weeks)).toEqual({});
  });
});

describe("computeGap", () => {
  it("subtracts supply from demand per role per week", () => {
    const demand: WeeklyMap = { "2026-01-05": { Carpenter: 3 } };
    const supply: WeeklyMap = { "2026-01-05": { Carpenter: 1 } };
    const gap = computeGap(demand, supply, ["Carpenter"], ["2026-01-05"]);
    expect(gap["2026-01-05"].Carpenter).toBe(2);
  });

  it("treats a role/week with no entry on either side as zero", () => {
    const gap = computeGap({}, {}, ["Carpenter"], ["2026-01-05"]);
    expect(gap["2026-01-05"]?.Carpenter ?? 0).toBe(0);
  });
});

describe("buildBlocks", () => {
  it("chunks an exact multiple of weeks evenly", () => {
    const blocks = buildBlocks(day(0), 21, 12); // 3-week blocks, 12 weeks out
    expect(blocks.map((b) => b.label)).toEqual(["W1–3", "W4–6", "W7–9", "W10–12"]);
    expect(blocks.every((b) => b.weeks.length === 3)).toBe(true);
  });

  it("gives the final block fewer weeks when weeksOut isn't a clean multiple (mid-block start edge case)", () => {
    const blocks = buildBlocks(day(0), 21, 10); // 10 weeks / 3-week blocks -> last block has 1 week
    expect(blocks.map((b) => b.label)).toEqual(["W1–3", "W4–6", "W7–9", "W10"]);
    expect(blocks[blocks.length - 1].weeks).toHaveLength(1);
  });

  it("falls back to 1-week blocks when blockLengthDays is sub-week", () => {
    const blocks = buildBlocks(day(0), 3, 2);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].label).toBe("W1");
  });
});

describe("classifyRag", () => {
  it("is always Covered when there is no demand, even with zero supply", () => {
    expect(classifyRag(0, 0, THRESHOLDS)).toEqual({ status: "Covered", severity: "normal" });
  });

  it("is Covered at and above the green threshold (over-allocation included)", () => {
    expect(classifyRag(2, 2, THRESHOLDS).status).toBe("Covered"); // ratio exactly 1.0
    expect(classifyRag(2, 5, THRESHOLDS).status).toBe("Covered"); // surplus / over-allocation
  });

  it("is Watch between the amber and green thresholds", () => {
    expect(classifyRag(10, 9, THRESHOLDS).status).toBe("Watch"); // ratio 0.9
  });

  it("is Short below the amber threshold, critical below the red threshold", () => {
    const moderate = classifyRag(10, 8, THRESHOLDS); // ratio 0.8
    expect(moderate).toEqual({ status: "Short", severity: "normal" });

    const severe = classifyRag(10, 5, THRESHOLDS); // ratio 0.5
    expect(severe).toEqual({ status: "Short", severity: "critical" });
  });
});

describe("buildForecastMatrix + computeHeadroom (hand-worked end-to-end example)", () => {
  // Carpenter: demand 2/week for 3 weeks (block 1), supply 1/week -> Short 1 each week, gap totals 3.
  // Electrician: demand 1/week, supply 1/week -> exactly Covered.
  // Plumber: no demand at all, no supply -> Covered trivially (the "no workers" edge case).
  const weeklyDemand: WeeklyMap = {
    "2026-01-05": { Carpenter: 2, Electrician: 1 },
    "2026-01-12": { Carpenter: 2, Electrician: 1 },
    "2026-01-19": { Carpenter: 2, Electrician: 1 },
  };
  const weeklySupply: WeeklyMap = {
    "2026-01-05": { Carpenter: 1, Electrician: 1 },
    "2026-01-12": { Carpenter: 1, Electrician: 1 },
    "2026-01-19": { Carpenter: 1, Electrician: 1 },
  };
  const roles = ["Carpenter", "Electrician", "Plumber"];
  const blocks = buildBlocks(day(0), 21, 3); // one 3-week block

  it("sums worker-weeks within the block and classifies each role x block cell", () => {
    const matrix = buildForecastMatrix(weeklyDemand, weeklySupply, roles, blocks, THRESHOLDS);

    const carpenter = matrix.find((c) => c.role === "Carpenter")!;
    expect(carpenter).toMatchObject({ demand: 6, supply: 3, gap: 3, status: "Short" });

    const electrician = matrix.find((c) => c.role === "Electrician")!;
    expect(electrician).toMatchObject({ demand: 3, supply: 3, gap: 0, status: "Covered" });

    const plumber = matrix.find((c) => c.role === "Plumber")!;
    expect(plumber).toMatchObject({ demand: 0, supply: 0, gap: 0, status: "Covered" });
  });

  it("derives headroom as the worst-case surplus, and lists every Short cell as a shortage", () => {
    const matrix = buildForecastMatrix(weeklyDemand, weeklySupply, roles, blocks, THRESHOLDS);
    const headroom = computeHeadroom(matrix, roles);

    expect(headroom.byRole).toEqual(
      expect.arrayContaining([
        { role: "Carpenter", headroom: -3 },
        { role: "Electrician", headroom: 0 },
        { role: "Plumber", headroom: 0 },
      ])
    );
    expect(headroom.canTakeOnMoreWork).toBe(false);
    expect(headroom.shortages).toEqual([{ role: "Carpenter", blockIndex: 0, blockLabel: "W1–3", gap: 3 }]);
    expect(headroom.totalHeadroom).toBe(0);
  });

  it("flips canTakeOnMoreWork to true once every role has non-negative headroom", () => {
    const fullySupplied = mergeWeeklyMaps(weeklySupply, { "2026-01-05": { Carpenter: 1 }, "2026-01-12": { Carpenter: 1 }, "2026-01-19": { Carpenter: 1 } });
    const matrix = buildForecastMatrix(weeklyDemand, fullySupplied, roles, blocks, THRESHOLDS);
    const headroom = computeHeadroom(matrix, roles);

    expect(headroom.canTakeOnMoreWork).toBe(true);
    expect(headroom.shortages).toEqual([]);
  });
});

describe("buildHeatmap", () => {
  it("produces one cell per role per week, classified the same way as the matrix", () => {
    const weeklyDemand: WeeklyMap = { "2026-01-05": { Carpenter: 2 } };
    const weeklySupply: WeeklyMap = { "2026-01-05": { Carpenter: 1 } };
    const heatmap = buildHeatmap(weeklyDemand, weeklySupply, ["Carpenter"], ["2026-01-05", "2026-01-12"], THRESHOLDS);

    expect(heatmap).toHaveLength(2);
    expect(heatmap[0]).toMatchObject({ trade: "Carpenter", week: "2026-01-05", demand: 2, supply: 1, gap: 1, status: "Short" });
    expect(heatmap[1]).toMatchObject({ trade: "Carpenter", week: "2026-01-12", demand: 0, supply: 0, status: "Covered" });
  });
});
