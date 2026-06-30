import { describe, expect, it } from "vitest";
import { computeMove, toDownstreamImpacted } from "@/lib/schedule/recalc";
import { DependencyCycleError, type ScheduleDependency, type ScheduleTask } from "@/lib/schedule/graph";

const BASE = Date.UTC(2026, 0, 5); // Monday, 5 Jan 2026
const day = (n: number) => new Date(BASE + n * 86_400_000);

function task(id: string, startDay: number, endDay: number): ScheduleTask {
  return { id, startDate: day(startDay), endDate: day(endDay) };
}

function dep(predecessorId: string, successorId: string, type: ScheduleDependency["type"], lagDays = 0): ScheduleDependency {
  return { predecessorId, successorId, type, lagDays };
}

describe("computeMove", () => {
  it("does not cascade when dragging a task earlier (creates more slack, not a delay)", () => {
    const tasks = [task("A", 5, 9), task("B", 9, 13)];
    const deps = [dep("A", "B", "FINISH_TO_START")];
    const { changes, requiresReason } = computeMove(tasks, deps, "A", day(0), day(4));
    expect(changes).toHaveLength(1);
    expect(changes[0].activityId).toBe("A");
    expect(requiresReason).toBe(false);
  });

  it("pushes a Finish-to-Start successor forward when the predecessor's new finish violates the gap", () => {
    const tasks = [task("A", 0, 4), task("B", 4, 8)];
    const deps = [dep("A", "B", "FINISH_TO_START")];
    const { changes, requiresReason } = computeMove(tasks, deps, "A", day(0), day(7)); // A now finishes day 7, after B's old start
    const b = changes.find((c) => c.activityId === "B");
    expect(b).toBeDefined();
    expect(b!.newStartDate).toEqual(day(7));
    expect(b!.newEndDate).toEqual(day(11)); // duration preserved (4 days)
    expect(requiresReason).toBe(true);
  });

  it("does not move a successor whose existing gap already satisfies the new predecessor dates", () => {
    const tasks = [task("A", 0, 4), task("B", 10, 14)]; // B already has a 6-day buffer
    const deps = [dep("A", "B", "FINISH_TO_START")];
    const { changes } = computeMove(tasks, deps, "A", day(0), day(6)); // A pushed out 2 days, still well within B's buffer
    expect(changes.some((c) => c.activityId === "B")).toBe(false);
  });

  it("cascades through a multi-level Finish-to-Start chain", () => {
    const tasks = [task("A", 0, 4), task("B", 4, 8), task("C", 8, 12)];
    const deps = [dep("A", "B", "FINISH_TO_START"), dep("B", "C", "FINISH_TO_START")];
    const { changes, requiresReason } = computeMove(tasks, deps, "A", day(0), day(6)); // A grows by 2 days
    const b = changes.find((c) => c.activityId === "B");
    const c = changes.find((c) => c.activityId === "C");
    expect(b!.newStartDate).toEqual(day(6));
    expect(c!.newStartDate).toEqual(day(10));
    expect(requiresReason).toBe(true);
  });

  it("cascades a Start-to-Start dependency by the successor's start", () => {
    const tasks = [task("A", 0, 10), task("B", 0, 6)];
    const deps = [dep("A", "B", "START_TO_START")];
    const { changes } = computeMove(tasks, deps, "A", day(3), day(13)); // A's start pushed to day 3
    const b = changes.find((c) => c.activityId === "B");
    expect(b!.newStartDate).toEqual(day(3));
    expect(b!.newEndDate).toEqual(day(9)); // 6-day duration preserved
  });

  it("cascades a Finish-to-Finish dependency by the successor's finish", () => {
    const tasks = [task("A", 0, 8), task("B", 2, 8)];
    const deps = [dep("A", "B", "FINISH_TO_FINISH")];
    const { changes } = computeMove(tasks, deps, "A", day(0), day(11)); // A now finishes day 11
    const b = changes.find((c) => c.activityId === "B");
    expect(b!.newEndDate).toEqual(day(11));
    expect(b!.newStartDate).toEqual(day(5)); // 6-day duration preserved
  });

  it("cascades a Start-to-Finish dependency by the successor's finish", () => {
    const tasks = [task("A", 6, 10), task("B", 0, 6)];
    const deps = [dep("A", "B", "START_TO_FINISH")];
    const { changes } = computeMove(tasks, deps, "A", day(8), day(12)); // A's start pushed to day 8
    const b = changes.find((c) => c.activityId === "B");
    expect(b!.newEndDate).toEqual(day(8));
  });

  it("respects lag on a cascaded Finish-to-Start dependency", () => {
    const tasks = [task("A", 0, 4), task("B", 6, 10)]; // 2-day lag required and currently exactly met
    const deps = [dep("A", "B", "FINISH_TO_START", 2)];
    const { changes } = computeMove(tasks, deps, "A", day(0), day(7)); // A now finishes day 7
    const b = changes.find((c) => c.activityId === "B");
    expect(b!.newStartDate).toEqual(day(9)); // 7 + 2 lag
  });

  it("allows a lead (negative lag) to keep tasks overlapping without forcing a push", () => {
    const tasks = [task("A", 0, 10), task("B", 8, 14)]; // B starts 2 days before A finishes (a lead)
    const deps = [dep("A", "B", "FINISH_TO_START", -2)];
    const { changes } = computeMove(tasks, deps, "A", day(0), day(9)); // A now finishes 1 day earlier — still within the lead
    expect(changes.some((c) => c.activityId === "B")).toBe(false);
  });

  it("throws DependencyCycleError when the dependency graph contains a cycle", () => {
    const tasks = [task("A", 0, 4), task("B", 4, 8)];
    const deps = [dep("A", "B", "FINISH_TO_START"), dep("B", "A", "FINISH_TO_START")];
    expect(() => computeMove(tasks, deps, "A", day(0), day(4))).toThrow(DependencyCycleError);
  });
});

describe("toDownstreamImpacted", () => {
  it("excludes the directly-moved task and resolves names by id", () => {
    const changes = [
      { activityId: "A", previousStartDate: day(0), previousEndDate: day(4), newStartDate: day(0), newEndDate: day(7) },
      { activityId: "B", previousStartDate: day(4), previousEndDate: day(8), newStartDate: day(7), newEndDate: day(11) },
    ];
    const nameById = new Map([
      ["A", "Demolition"],
      ["B", "Framing"],
    ]);
    const downstream = toDownstreamImpacted(changes, "A", nameById);
    expect(downstream).toHaveLength(1);
    expect(downstream[0]).toMatchObject({ activityId: "B", name: "Framing" });
  });

  it("falls back to an empty name when the id isn't in the map", () => {
    const changes = [
      { activityId: "B", previousStartDate: day(4), previousEndDate: day(8), newStartDate: day(7), newEndDate: day(11) },
    ];
    const downstream = toDownstreamImpacted(changes, "A", new Map());
    expect(downstream[0].name).toBe("");
  });
});
