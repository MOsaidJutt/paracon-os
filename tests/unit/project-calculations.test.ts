import { describe, expect, it } from "vitest";
import {
  aggregateLabourDemand,
  deriveMilestones,
  filterUpcomingMilestones,
  type ActivityForDemand,
  type ActivityForMilestone,
} from "@/lib/projects/calculations";

const BASE = Date.UTC(2026, 0, 5); // Monday, 5 Jan 2026
const day = (n: number) => new Date(BASE + n * 86_400_000);

describe("deriveMilestones", () => {
  const activities: ActivityForMilestone[] = [
    { id: "a1", name: "Ceiling grid", endDate: day(10), isCritical: false, milestoneType: null },
    { id: "a2", name: "Services rough-in", endDate: day(20), isCritical: true, milestoneType: "Services Rough-In" },
    { id: "a3", name: "Final fitout", endDate: day(40), isCritical: true, milestoneType: null },
  ];

  it("only derives a milestone for critical activities", () => {
    const milestones = deriveMilestones(activities);
    expect(milestones).toHaveLength(2);
    expect(milestones.map((m) => m.sourceActivityId)).toEqual(["a2", "a3"]);
  });

  it("prefixes the milestone name with its type when one is set", () => {
    const milestones = deriveMilestones(activities);
    expect(milestones[0].name).toBe("Services Rough-In: Services rough-in");
  });

  it("falls back to the activity name when no milestone type is set", () => {
    const milestones = deriveMilestones(activities);
    expect(milestones[1].name).toBe("Final fitout");
  });

  it("dates the milestone to the activity's end date", () => {
    const milestones = deriveMilestones(activities);
    expect(milestones[0].date).toEqual(day(20));
  });
});

describe("filterUpcomingMilestones", () => {
  const milestones = [
    { id: "m1", date: day(-1) }, // already past
    { id: "m2", date: day(5) },
    { id: "m3", date: day(29) },
    { id: "m4", date: day(31) }, // outside the 30-day window
  ];

  it("keeps only milestones within [from, from + 30 days], sorted soonest first", () => {
    const upcoming = filterUpcomingMilestones(milestones, day(0), 30);
    expect(upcoming.map((m) => m.id)).toEqual(["m2", "m3"]);
  });

  it("excludes a milestone exactly one day past the window", () => {
    const upcoming = filterUpcomingMilestones(milestones, day(0), 30);
    expect(upcoming.find((m) => m.id === "m4")).toBeUndefined();
  });
});

describe("aggregateLabourDemand", () => {
  it("sums per-role headcount across every week an activity spans", () => {
    const activities: ActivityForDemand[] = [
      { startDate: day(0), endDate: day(13), labourRequired: { Carpenter: 4, Electrician: 2 } },
    ];
    const demand = aggregateLabourDemand(activities);
    const weeks = Object.keys(demand).sort();
    expect(weeks).toHaveLength(2);
    expect(demand[weeks[0]]).toEqual({ Carpenter: 4, Electrician: 2 });
    expect(demand[weeks[1]]).toEqual({ Carpenter: 4, Electrician: 2 });
  });

  it("combines overlapping activities into the same week's totals", () => {
    const activities: ActivityForDemand[] = [
      { startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 4 } },
      { startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 2, Plumber: 1 } },
    ];
    const demand = aggregateLabourDemand(activities);
    const week = Object.values(demand)[0];
    expect(week).toEqual({ Carpenter: 6, Plumber: 1 });
  });

  it("keys weeks by the Monday of the ISO week, regardless of which weekday the activity starts on", () => {
    const activities: ActivityForDemand[] = [{ startDate: day(2), endDate: day(2), labourRequired: { Painter: 1 } }];
    const demand = aggregateLabourDemand(activities);
    expect(Object.keys(demand)).toEqual(["2026-01-05"]);
  });
});
