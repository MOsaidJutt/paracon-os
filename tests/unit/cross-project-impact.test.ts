import { describe, expect, it } from "vitest";
import { findCrossProjectImpact, weeksInRange } from "@/lib/schedule/cross-project-impact";

const WEEK_1 = new Date("2026-06-22T00:00:00.000Z");
const WEEK_2 = new Date("2026-06-29T00:00:00.000Z");
const WEEK_3 = new Date("2026-07-06T00:00:00.000Z");

describe("weeksInRange", () => {
  it("returns a single week when start and end fall in the same ISO week", () => {
    const weeks = weeksInRange(new Date("2026-06-23T00:00:00.000Z"), new Date("2026-06-25T00:00:00.000Z"));
    expect(weeks).toHaveLength(1);
    expect(weeks[0].getTime()).toBe(WEEK_1.getTime());
  });

  it("returns every Monday spanning a multi-week range, inclusive", () => {
    const weeks = weeksInRange(WEEK_1, WEEK_3);
    expect(weeks.map((w) => w.toISOString().slice(0, 10))).toEqual(["2026-06-22", "2026-06-29", "2026-07-06"]);
  });
});

describe("findCrossProjectImpact", () => {
  it("flags a worker held on this project's original window who is also booked on another project during the new window", () => {
    const changes = [
      {
        activityId: "act-1",
        trade: "Carpenter",
        previousStartDate: WEEK_1,
        previousEndDate: WEEK_1,
        newStartDate: WEEK_2,
        newEndDate: WEEK_2,
      },
    ];
    const allocations = [
      // Marcus holds the Carpenter task on Project A (this project) during its original week.
      { workerId: "w1", workerName: "Marcus Webb", capability: "Carpenter", projectId: "proj-A", projectName: "Project A", weekStart: WEEK_1 },
      // Marcus is already booked on Project B for the NEW (shifted) week — the snowball.
      { workerId: "w1", workerName: "Marcus Webb", capability: "Carpenter", projectId: "proj-B", projectName: "Project B", weekStart: WEEK_2 },
    ];

    const result = findCrossProjectImpact("proj-A", changes, allocations);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ workerId: "w1", otherProjectId: "proj-B", otherProjectName: "Project B" });
    expect(result[0].conflictWeeks).toEqual(["2026-06-29"]);
  });

  it("does not flag a worker with no allocation on another project", () => {
    const changes = [
      { activityId: "act-1", trade: "Carpenter", previousStartDate: WEEK_1, previousEndDate: WEEK_1, newStartDate: WEEK_2, newEndDate: WEEK_2 },
    ];
    const allocations = [
      { workerId: "w1", workerName: "Marcus Webb", capability: "Carpenter", projectId: "proj-A", projectName: "Project A", weekStart: WEEK_1 },
    ];
    expect(findCrossProjectImpact("proj-A", changes, allocations)).toEqual([]);
  });

  it("does not flag a worker whose trade doesn't match the delayed activity's trade", () => {
    const changes = [
      { activityId: "act-1", trade: "Carpenter", previousStartDate: WEEK_1, previousEndDate: WEEK_1, newStartDate: WEEK_2, newEndDate: WEEK_2 },
    ];
    const allocations = [
      { workerId: "w1", workerName: "Priya Nair", capability: "Electrician", projectId: "proj-A", projectName: "Project A", weekStart: WEEK_1 },
      { workerId: "w1", workerName: "Priya Nair", capability: "Electrician", projectId: "proj-B", projectName: "Project B", weekStart: WEEK_2 },
    ];
    expect(findCrossProjectImpact("proj-A", changes, allocations)).toEqual([]);
  });

  it("groups multiple conflicting weeks against the same other project into one entry", () => {
    const changes = [
      { activityId: "act-1", trade: "Carpenter", previousStartDate: WEEK_1, previousEndDate: WEEK_1, newStartDate: WEEK_2, newEndDate: WEEK_3 },
    ];
    const allocations = [
      { workerId: "w1", workerName: "Marcus Webb", capability: "Carpenter", projectId: "proj-A", projectName: "Project A", weekStart: WEEK_1 },
      { workerId: "w1", workerName: "Marcus Webb", capability: "Carpenter", projectId: "proj-B", projectName: "Project B", weekStart: WEEK_2 },
      { workerId: "w1", workerName: "Marcus Webb", capability: "Carpenter", projectId: "proj-B", projectName: "Project B", weekStart: WEEK_3 },
    ];
    const result = findCrossProjectImpact("proj-A", changes, allocations);
    expect(result).toHaveLength(1);
    expect(result[0].conflictWeeks).toEqual(["2026-06-29", "2026-07-06"]);
  });

  it("does not flag a worker who wasn't actually holding the task on this project originally", () => {
    const changes = [
      { activityId: "act-1", trade: "Carpenter", previousStartDate: WEEK_1, previousEndDate: WEEK_1, newStartDate: WEEK_2, newEndDate: WEEK_2 },
    ];
    // Marcus is booked on Project B during the new week, but was never allocated to Project A at all.
    const allocations = [
      { workerId: "w1", workerName: "Marcus Webb", capability: "Carpenter", projectId: "proj-B", projectName: "Project B", weekStart: WEEK_2 },
    ];
    expect(findCrossProjectImpact("proj-A", changes, allocations)).toEqual([]);
  });
});
