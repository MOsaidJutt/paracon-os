import { describe, expect, it } from "vitest";
import { computeMove, toDownstreamImpacted } from "@/lib/schedule/recalc";
import type { ScheduleDependency, ScheduleTask } from "@/lib/schedule/graph";

const BASE = Date.UTC(2026, 0, 5);
const day = (n: number) => new Date(BASE + n * 86_400_000);

function task(id: string, startDay: number, endDay: number): ScheduleTask {
  return { id, startDate: day(startDay), endDate: day(endDay) };
}

function dep(predecessorId: string, successorId: string, type: ScheduleDependency["type"], lagDays = 0): ScheduleDependency {
  return { predecessorId, successorId, type, lagDays };
}

/**
 * Mirrors what app/api/projects/[id]/activities/[activityId]/commit-move
 * builds before writing a DelayRecord: the moved task's own before/after
 * dates plus a snapshot of every downstream task the cascade touched. These
 * tests exercise that composition directly (the route itself needs a live
 * Prisma transaction, so it's covered by the Playwright e2e spec instead).
 */
describe("delay capture", () => {
  it("requires a reason and captures downstream impact when a push cascades to a later date", () => {
    const tasks = [task("Demolition", 0, 4), task("Framing", 4, 8), task("Electrical", 8, 12)];
    const deps = [dep("Demolition", "Framing", "FINISH_TO_START"), dep("Framing", "Electrical", "FINISH_TO_START")];
    const nameById = new Map([
      ["Demolition", "Demolition & Site clearing"],
      ["Framing", "Framing"],
      ["Electrical", "Electrical rough-in"],
    ]);

    const { changes, requiresReason } = computeMove(tasks, deps, "Demolition", day(0), day(5)); // +1 day, matching screenshot 1's "+1 day" delta
    expect(requiresReason).toBe(true);

    const moved = changes.find((c) => c.activityId === "Demolition")!;
    expect(moved.newEndDate).toEqual(day(5));

    const downstream = toDownstreamImpacted(changes, "Demolition", nameById);
    expect(downstream.map((d) => d.activityId).sort()).toEqual(["Electrical", "Framing"]);
    expect(downstream.find((d) => d.activityId === "Framing")).toMatchObject({
      name: "Framing",
      newStartDate: day(5),
      newEndDate: day(9),
    });
  });

  it("requires no reason and reports no downstream impact for a move that only opens up slack", () => {
    const tasks = [task("Demolition", 0, 4), task("Framing", 9, 13)];
    const deps = [dep("Demolition", "Framing", "FINISH_TO_START")];

    const { changes, requiresReason } = computeMove(tasks, deps, "Demolition", day(0), day(3)); // finishes a day early
    expect(requiresReason).toBe(false);

    const downstream = toDownstreamImpacted(changes, "Demolition", new Map());
    expect(downstream).toHaveLength(0);
  });

  it("still requires a reason for a direct push even when it has no dependents at all", () => {
    const tasks = [task("Solo task", 0, 4)];
    const { changes, requiresReason } = computeMove(tasks, [], "Solo task", day(2), day(6));
    expect(requiresReason).toBe(true);
    expect(changes).toHaveLength(1);
    expect(toDownstreamImpacted(changes, "Solo task", new Map())).toHaveLength(0);
  });

  it("reverts cleanly when the proposed dates exactly match the current ones (no-op, no reason)", () => {
    const tasks = [task("A", 0, 4), task("B", 4, 8)];
    const deps = [dep("A", "B", "FINISH_TO_START")];
    const { changes, requiresReason } = computeMove(tasks, deps, "A", day(0), day(4));
    expect(changes).toHaveLength(0);
    expect(requiresReason).toBe(false);
  });
});
