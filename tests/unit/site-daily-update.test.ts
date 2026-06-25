import { describe, expect, it } from "vitest";
import { deriveSuggestedAttendance, parseDateOnly, assertNonEmptyFile } from "@/lib/site/daily-update-service";
import { dailyUpdateSubmitSchema } from "@/lib/validations/site-update";
import { BadRequestError } from "@/lib/errors";

describe("deriveSuggestedAttendance", () => {
  it("falls back to this week's allocation when there is no prior update", () => {
    expect(deriveSuggestedAttendance(null, ["w1", "w2"])).toEqual([
      { workerId: "w1", present: true },
      { workerId: "w2", present: true },
    ]);
  });

  it("suggests yesterday's present workers when a prior update exists", () => {
    const prior = [
      { workerId: "w1", present: true },
      { workerId: "w2", present: false },
    ];
    expect(deriveSuggestedAttendance(prior, ["ignored"])).toEqual([{ workerId: "w1", present: true }]);
  });

  it("returns an empty suggestion when yesterday's whole crew was absent", () => {
    expect(deriveSuggestedAttendance([{ workerId: "w1", present: false }], [])).toEqual([]);
  });

  it("returns an empty suggestion on a brand-new project with no allocation yet", () => {
    expect(deriveSuggestedAttendance(null, [])).toEqual([]);
  });
});

describe("parseDateOnly", () => {
  it("parses a YYYY-MM-DD string as UTC midnight", () => {
    expect(parseDateOnly("2026-06-24").toISOString()).toBe("2026-06-24T00:00:00.000Z");
  });
});

describe("assertNonEmptyFile", () => {
  it("rejects an empty file", () => {
    expect(() => assertNonEmptyFile(0, 1000)).toThrow(BadRequestError);
  });

  it("rejects a file over the limit", () => {
    expect(() => assertNonEmptyFile(2000, 1000)).toThrow(BadRequestError);
  });

  it("allows a file within the limit", () => {
    expect(() => assertNonEmptyFile(500, 1000)).not.toThrow();
  });
});

// The vision doc's literal Required/Optional split: "Required: Crew Today,
// Progress. Optional: Issue, Photo, Note."
describe("dailyUpdateSubmitSchema (Required: Crew Today, Progress)", () => {
  const base = { projectId: "proj-1", date: "2026-06-24" };

  it("rejects an empty crew", () => {
    const result = dailyUpdateSubmitSchema.safeParse({ ...base, attendance: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a crew with no progress signal (no ticked task and no note)", () => {
    const result = dailyUpdateSubmitSchema.safeParse({
      ...base,
      attendance: [{ workerId: "w1", present: true }],
      taskProgress: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a crew with at least one ticked task, even with no note", () => {
    const result = dailyUpdateSubmitSchema.safeParse({
      ...base,
      attendance: [{ workerId: "w1", present: true }],
      taskProgress: [{ programActivityId: "act-1", status: "On Track" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a crew with no ticked task but a non-empty note (no active activity that day)", () => {
    const result = dailyUpdateSubmitSchema.safeParse({
      ...base,
      attendance: [{ workerId: "w1", present: true }],
      taskProgress: [],
      note: "Between trades today, no program activity active.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a note that is only whitespace as a progress signal", () => {
    const result = dailyUpdateSubmitSchema.safeParse({
      ...base,
      attendance: [{ workerId: "w1", present: true }],
      taskProgress: [],
      note: "   ",
    });
    expect(result.success).toBe(false);
  });
});
