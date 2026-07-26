import { describe, expect, it } from "vitest";
import {
  attendancePercent,
  averageScore,
  complianceCurrentPercent,
  labourEfficiencyPercent,
  labourUtilisationPercent,
  projectsOnTrackPercent,
  ratePercent,
  revenueWonPercent,
  tradeUtilisation,
} from "@/lib/dashboard/simple-metrics";
import { bandForPercent } from "@/lib/dashboard/rag";
import type { MatrixCell } from "@/lib/forecast/engine";

function cell(role: string, blockIndex: number, demand: number, supply: number): MatrixCell {
  return {
    role,
    blockIndex,
    blockLabel: `Block ${blockIndex}`,
    demand,
    supply,
    gap: Math.max(0, demand - supply),
    status: "Green",
    severity: "normal",
  } as MatrixCell;
}

describe("revenueWonPercent", () => {
  it("measures revenue won against the configured target", () => {
    expect(revenueWonPercent(3_400_000, 5_000_000)).toBeCloseTo(68);
  });

  it("reports beating the target rather than capping at 100", () => {
    expect(revenueWonPercent(6_000_000, 5_000_000)).toBeCloseTo(120);
  });

  it("returns null rather than 0 when no target is set", () => {
    expect(revenueWonPercent(1_000_000, 0)).toBeNull();
  });
});

describe("ratePercent", () => {
  it("converts a 0-1 rate to a percentage", () => {
    expect(ratePercent(0.42, true)).toBeCloseTo(42);
  });

  it("returns null when there is no signal, so a new org isn't shown a red zero", () => {
    expect(ratePercent(0, false)).toBeNull();
    expect(ratePercent(null, true)).toBeNull();
  });

  it("clamps a rate above 1 to 100 percent", () => {
    expect(ratePercent(1.4, true)).toBe(100);
  });
});

describe("labourUtilisationPercent", () => {
  it("uses only the current block and sums across trades", () => {
    const matrix = [
      cell("Carpenter", 0, 6, 10),
      cell("Labourer", 0, 4, 10),
      // A later block must not move the current reading.
      cell("Carpenter", 1, 100, 1),
    ];
    expect(labourUtilisationPercent(matrix)).toBeCloseTo(50);
  });

  it("caps at 100 so a shortage never reads as a good number", () => {
    expect(labourUtilisationPercent([cell("Carpenter", 0, 30, 10)])).toBe(100);
  });

  it("returns null when there is no supply to measure against", () => {
    expect(labourUtilisationPercent([cell("Carpenter", 0, 5, 0)])).toBeNull();
    expect(labourUtilisationPercent([])).toBeNull();
  });
});

describe("projectsOnTrackPercent", () => {
  it("counts only On Track against the total", () => {
    expect(projectsOnTrackPercent(["On Track", "On Track", "Attention", "Critical"])).toBe(50);
  });

  it("returns null with no projects at all", () => {
    expect(projectsOnTrackPercent([])).toBeNull();
  });
});

describe("complianceCurrentPercent", () => {
  it("treats Expiring and Expired alike as not current", () => {
    expect(complianceCurrentPercent(["Valid", "Valid", "Expiring", "Expired"])).toBe(50);
  });

  it("returns null with no documents on file", () => {
    expect(complianceCurrentPercent([])).toBeNull();
  });
});

describe("attendancePercent", () => {
  it("aggregates days across every record rather than averaging rates", () => {
    // 90/100 and 1/2 — averaging the two rates would give 70%, which
    // over-weights the two-day record.
    const records = [
      { attendanceDays: 90, expectedDays: 100 },
      { attendanceDays: 1, expectedDays: 2 },
    ];
    expect(attendancePercent(records)).toBeCloseTo(89.2, 1);
  });

  it("returns null when nobody was ever rostered", () => {
    expect(attendancePercent([{ attendanceDays: 0, expectedDays: 0 }])).toBeNull();
  });
});

describe("labourEfficiencyPercent", () => {
  it("reads 100 percent when the work took exactly the hours planned", () => {
    expect(labourEfficiencyPercent([{ plannedHours: 100, actualHours: 100 }])).toBe(100);
  });

  it("falls below 100 when a crew over-ran the plan", () => {
    expect(labourEfficiencyPercent([{ plannedHours: 80, actualHours: 100 }])).toBeCloseTo(80);
  });

  it("caps at 100 when the work came in under plan", () => {
    expect(labourEfficiencyPercent([{ plannedHours: 120, actualHours: 100 }])).toBe(100);
  });

  it("returns null when no hours were worked", () => {
    expect(labourEfficiencyPercent([{ plannedHours: 100, actualHours: 0 }])).toBeNull();
  });
});

describe("averageScore", () => {
  it("averages the scores given", () => {
    expect(averageScore([80, 90, 100])).toBeCloseTo(90);
  });

  it("returns null for nobody assessed", () => {
    expect(averageScore([])).toBeNull();
  });
});

describe("tradeUtilisation", () => {
  const matrix = [cell("Carpenter", 0, 8, 10), cell("Electrician", 0, 2, 10), cell("Carpenter", 1, 20, 10)];

  it("pairs current-block utilisation with worst-case headroom", () => {
    const result = tradeUtilisation(matrix, [
      { role: "Carpenter", headroom: -10 },
      { role: "Electrician", headroom: 8 },
    ]);

    expect(result).toEqual([
      { role: "Carpenter", utilisationPercent: 80, headroom: -10, demand: 8, supply: 10 },
      { role: "Electrician", utilisationPercent: 20, headroom: 8, demand: 2, supply: 10 },
    ]);
  });

  it("reports a trade with no forecast cells as unused rather than dropping it", () => {
    const result = tradeUtilisation(matrix, [{ role: "Plumber", headroom: 0 }]);
    expect(result).toEqual([{ role: "Plumber", utilisationPercent: 0, headroom: 0, demand: 0, supply: 0 }]);
  });
});

describe("bandForPercent", () => {
  it("uses the caller's thresholds, inclusive at each boundary", () => {
    expect(bandForPercent(80, 80, 50)).toBe("good");
    expect(bandForPercent(79.9, 80, 50)).toBe("warning");
    expect(bandForPercent(50, 80, 50)).toBe("warning");
    expect(bandForPercent(49.9, 80, 50)).toBe("bad");
  });
});
