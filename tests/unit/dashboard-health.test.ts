import { describe, expect, it } from "vitest";
import { computeProjectHealth } from "@/lib/dashboard/health";
import type { DashboardHealthConfig } from "@/lib/dashboard/config";

const NOW = new Date("2026-06-18T00:00:00.000Z");
const CONFIG: DashboardHealthConfig = {
  attentionMilestoneWindowDays: 10,
  criticalIssueSeverities: ["High"],
  shortageWatchWeeks: 2,
};

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("computeProjectHealth", () => {
  it("is On Track with no overdue dates, no open issues and no shortfall", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [daysFromNow(30)], openIssueSeverities: [], weeklyShortfall: [0, 0, 0] },
      CONFIG
    );
    expect(result.status).toBe("On Track");
    expect(result.reasons).toHaveLength(0);
  });

  it("is Critical when a critical milestone is overdue", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [daysFromNow(-1)], openIssueSeverities: [], weeklyShortfall: [0] },
      CONFIG
    );
    expect(result.status).toBe("Critical");
    expect(result.reasons.some((r) => r.includes("overdue"))).toBe(true);
  });

  it("is Attention when a critical milestone falls inside the watch window but isn't overdue", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [daysFromNow(5)], openIssueSeverities: [], weeklyShortfall: [0] },
      CONFIG
    );
    expect(result.status).toBe("Attention");
  });

  it("is On Track when the nearest milestone is outside the attention window", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [daysFromNow(11)], openIssueSeverities: [], weeklyShortfall: [0] },
      CONFIG
    );
    expect(result.status).toBe("On Track");
  });

  it("is Critical when an open issue is at a critical severity", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [], openIssueSeverities: ["High"], weeklyShortfall: [0] },
      CONFIG
    );
    expect(result.status).toBe("Critical");
  });

  it("is Attention when an open issue exists but none are critical severity", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [], openIssueSeverities: ["Low", "Medium"], weeklyShortfall: [0] },
      CONFIG
    );
    expect(result.status).toBe("Attention");
  });

  it("is Critical when there is a labour shortfall this week", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [], openIssueSeverities: [], weeklyShortfall: [2, 0, 0] },
      CONFIG
    );
    expect(result.status).toBe("Critical");
    expect(result.reasons.some((r) => r.includes("this week"))).toBe(true);
  });

  it("is Attention when a labour shortfall falls inside the watch window but not this week", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [], openIssueSeverities: [], weeklyShortfall: [0, 3, 0] },
      CONFIG
    );
    expect(result.status).toBe("Attention");
  });

  it("is On Track when a shortfall falls outside the watch window", () => {
    const result = computeProjectHealth(
      { now: NOW, milestoneDates: [], openIssueSeverities: [], weeklyShortfall: [0, 0, 4] },
      CONFIG
    );
    expect(result.status).toBe("On Track");
  });

  it("surfaces every triggered reason, not just the worst one", () => {
    const result = computeProjectHealth(
      {
        now: NOW,
        milestoneDates: [daysFromNow(-2)],
        openIssueSeverities: ["High", "Low"],
        weeklyShortfall: [1],
      },
      CONFIG
    );
    expect(result.status).toBe("Critical");
    expect(result.reasons.length).toBeGreaterThan(1);
  });
});
