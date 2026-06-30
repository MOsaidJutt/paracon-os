import { describe, expect, it } from "vitest";
import { computeCriticalPath } from "@/lib/schedule/critical-path";
import { DependencyCycleError, type ScheduleDependency, type ScheduleTask } from "@/lib/schedule/graph";

const BASE = Date.UTC(2026, 0, 5); // Monday, 5 Jan 2026
const day = (n: number) => new Date(BASE + n * 86_400_000);

function task(id: string, startDay: number, endDay: number): ScheduleTask {
  return { id, startDate: day(startDay), endDate: day(endDay) };
}

function dep(predecessorId: string, successorId: string, type: ScheduleDependency["type"], lagDays = 0): ScheduleDependency {
  return { predecessorId, successorId, type, lagDays };
}

describe("computeCriticalPath", () => {
  it("marks a simple back-to-back FS chain entirely critical (zero float)", () => {
    const tasks = [task("A", 0, 4), task("B", 4, 8), task("C", 8, 12)];
    const deps = [dep("A", "B", "FINISH_TO_START"), dep("B", "C", "FINISH_TO_START")];
    const result = computeCriticalPath(tasks, deps);
    expect(result.get("A")!.isCritical).toBe(true);
    expect(result.get("B")!.isCritical).toBe(true);
    expect(result.get("C")!.isCritical).toBe(true);
    expect(result.get("A")!.floatDays).toBe(0);
  });

  it("gives a predecessor real float equal to an existing gap before its successor", () => {
    // A finishes day 4; B doesn't start until day 9 — a 5-day buffer beyond the 0-lag requirement.
    const tasks = [task("A", 0, 4), task("B", 9, 13)];
    const deps = [dep("A", "B", "FINISH_TO_START")];
    const result = computeCriticalPath(tasks, deps);
    expect(result.get("A")!.floatDays).toBe(5);
    expect(result.get("A")!.isCritical).toBe(false);
    // B is the sink (drives the project end) — always zero float.
    expect(result.get("B")!.floatDays).toBe(0);
    expect(result.get("B")!.isCritical).toBe(true);
  });

  it("flags negative float when current dates already violate a dependency constraint", () => {
    // B starts BEFORE A finishes even though it's a Finish-to-Start dependency.
    const tasks = [task("A", 0, 10), task("B", 5, 9)];
    const deps = [dep("A", "B", "FINISH_TO_START")];
    const result = computeCriticalPath(tasks, deps);
    expect(result.get("A")!.floatDays).toBeLessThan(0);
    expect(result.get("A")!.isCritical).toBe(true);
  });

  it("applies lag to a Finish-to-Start dependency", () => {
    // 2-day cure time required between A finishing and B starting; B currently starts exactly 2 days after.
    const tasks = [task("A", 0, 4), task("B", 6, 10)];
    const deps = [dep("A", "B", "FINISH_TO_START", 2)];
    const result = computeCriticalPath(tasks, deps);
    expect(result.get("A")!.floatDays).toBe(0);
  });

  it("applies lead (negative lag) to allow overlap on a Start-to-Start dependency", () => {
    // B is allowed to start 2 days before A (a lead/overlap) and currently does exactly that.
    const tasks = [task("A", 5, 10), task("B", 3, 8)];
    const deps = [dep("A", "B", "START_TO_START", -2)];
    const result = computeCriticalPath(tasks, deps);
    expect(result.get("A")!.floatDays).toBe(0);
  });

  it("handles Finish-to-Finish dependencies", () => {
    // Both must finish together (lag 0); they currently do.
    const tasks = [task("A", 0, 8), task("B", 2, 8)];
    const deps = [dep("A", "B", "FINISH_TO_FINISH")];
    const result = computeCriticalPath(tasks, deps);
    expect(result.get("A")!.floatDays).toBe(0);
  });

  it("handles Start-to-Finish dependencies", () => {
    // B must finish no earlier than A starts + lag; currently exactly on the boundary.
    const tasks = [task("A", 6, 10), task("B", 0, 6)];
    const deps = [dep("A", "B", "START_TO_FINISH")];
    const result = computeCriticalPath(tasks, deps);
    expect(result.get("A")!.floatDays).toBe(0);
  });

  it("a task unconnected to the longest chain shows float relative to the project's actual end", () => {
    const tasks = [task("A", 0, 4), task("B", 4, 20), task("isolated", 0, 2)];
    const deps = [dep("A", "B", "FINISH_TO_START")];
    const result = computeCriticalPath(tasks, deps);
    // Project end is day 20 (B). The isolated task has no successors, so its
    // late finish is the project end, giving it 18 days of float.
    expect(result.get("isolated")!.floatDays).toBe(18);
    expect(result.get("isolated")!.isCritical).toBe(false);
  });

  it("throws DependencyCycleError when the dependency graph contains a cycle", () => {
    const tasks = [task("A", 0, 4), task("B", 4, 8)];
    const deps = [dep("A", "B", "FINISH_TO_START"), dep("B", "A", "FINISH_TO_START")];
    expect(() => computeCriticalPath(tasks, deps)).toThrow(DependencyCycleError);
  });

  it("returns an empty map for an empty task list", () => {
    expect(computeCriticalPath([], []).size).toBe(0);
  });
});
