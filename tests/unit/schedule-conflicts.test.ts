import { describe, expect, it } from "vitest";
import { findTradeConflicts, type ProjectActivities } from "@/lib/schedule/conflicts";
import type { WeeklyMap } from "@/lib/forecast/engine";

const BASE = Date.UTC(2026, 0, 5); // Monday, 5 Jan 2026 — a Monday, matching weekKey's ISO-week convention
const day = (n: number) => new Date(BASE + n * 86_400_000);
const WEEK_1 = "2026-01-05";

describe("findTradeConflicts", () => {
  it("flags a conflict when two projects compete for the same trade beyond supply", () => {
    const activitiesByProject = new Map<string, ProjectActivities>([
      [
        "p1",
        {
          projectName: "Macquarie PI",
          activities: [{ id: "a1", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 3 } }],
        },
      ],
      [
        "p2",
        {
          projectName: "Martin PI",
          activities: [{ id: "a2", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 2 } }],
        },
      ],
    ]);
    const supply: WeeklyMap = { [WEEK_1]: { Carpenter: 4 } };

    const conflicts = findTradeConflicts(activitiesByProject, supply);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ week: WEEK_1, trade: "Carpenter", demand: 5, supply: 4, gap: 1 });
    expect(conflicts[0].projects.map((p) => p.projectId).sort()).toEqual(["p1", "p2"]);
  });

  it("does not flag a single project's own shortfall as a cross-project conflict", () => {
    const activitiesByProject = new Map<string, ProjectActivities>([
      [
        "p1",
        {
          projectName: "Macquarie PI",
          activities: [{ id: "a1", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 10 } }],
        },
      ],
    ]);
    const supply: WeeklyMap = { [WEEK_1]: { Carpenter: 2 } };

    expect(findTradeConflicts(activitiesByProject, supply)).toHaveLength(0);
  });

  it("does not flag two projects competing for a trade when supply is sufficient", () => {
    const activitiesByProject = new Map<string, ProjectActivities>([
      [
        "p1",
        {
          projectName: "Macquarie PI",
          activities: [{ id: "a1", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 2 } }],
        },
      ],
      [
        "p2",
        {
          projectName: "Martin PI",
          activities: [{ id: "a2", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 2 } }],
        },
      ],
    ]);
    const supply: WeeklyMap = { [WEEK_1]: { Carpenter: 10 } };

    expect(findTradeConflicts(activitiesByProject, supply)).toHaveLength(0);
  });

  it("excludes a parent/phase row's labourRequired from demand, same as the forecast engine", () => {
    const activitiesByProject = new Map<string, ProjectActivities>([
      [
        "p1",
        {
          projectName: "Macquarie PI",
          activities: [
            { id: "phase1", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 99 } },
            { id: "task1", parentId: "phase1", startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 2 } },
          ],
        },
      ],
      [
        "p2",
        {
          projectName: "Martin PI",
          activities: [{ id: "a2", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 2 } }],
        },
      ],
    ]);
    const supply: WeeklyMap = { [WEEK_1]: { Carpenter: 3 } };

    const conflicts = findTradeConflicts(activitiesByProject, supply);
    expect(conflicts[0].demand).toBe(4); // 2 + 2, not 99 + 2 + 2
  });

  it("sorts conflicts by week, then by largest gap first", () => {
    const activitiesByProject = new Map<string, ProjectActivities>([
      [
        "p1",
        {
          projectName: "Macquarie PI",
          activities: [
            { id: "a1", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 5, Plumber: 4 } },
          ],
        },
      ],
      [
        "p2",
        {
          projectName: "Martin PI",
          activities: [
            { id: "a2", parentId: null, startDate: day(0), endDate: day(4), labourRequired: { Carpenter: 5, Plumber: 4 } },
          ],
        },
      ],
    ]);
    const supply: WeeklyMap = { [WEEK_1]: { Carpenter: 2, Plumber: 6 } };

    const conflicts = findTradeConflicts(activitiesByProject, supply);
    expect(conflicts[0].trade).toBe("Carpenter"); // gap 8 > Plumber's gap 2
    expect(conflicts[1].trade).toBe("Plumber");
  });
});
