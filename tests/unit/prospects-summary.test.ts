import { describe, expect, it } from "vitest";
import { summariseProspects, nextActionState, type ProspectSummaryInput } from "@/lib/prospects/summary";
import { createProspectSchema } from "@/lib/validations/prospect";
import { parsePreference, PREFERENCE_DEFAULTS } from "@/lib/preferences-registry";

const STAGES = ["Cold", "Warm"];

function lead(overrides: Partial<ProspectSummaryInput> = {}): ProspectSummaryInput {
  return {
    stage: "Cold",
    estimatedValue: null,
    probability: null,
    convertedTenderId: null,
    ...overrides,
  };
}

describe("summariseProspects", () => {
  it("counts converted leads against every lead ever raised", () => {
    const summary = summariseProspects(
      [lead(), lead(), lead({ convertedTenderId: "t1" }), lead({ convertedTenderId: "t2" })],
      STAGES
    );
    expect(summary.total).toBe(4);
    expect(summary.converted).toBe(2);
    expect(summary.conversionPercent).toBe(50);
  });

  it("returns null conversion for a brand-new org rather than a red zero", () => {
    expect(summariseProspects([], STAGES).conversionPercent).toBeNull();
  });

  it("treats converted as derived from the tender link, not from a stage name", () => {
    // A lead still sitting in "Warm" but carrying a tender id has left the
    // pipeline; the stage label is irrelevant.
    const summary = summariseProspects([lead({ stage: "Warm", convertedTenderId: "t1" })], STAGES);
    expect(summary.converted).toBe(1);
    expect(summary.byStage.find((s) => s.stage === "Warm")?.count).toBe(0);
  });

  it("reports a lane per configured stage, in the declared order", () => {
    const summary = summariseProspects([lead({ stage: "Warm" })], ["Cold", "Warm", "Hot"]);
    expect(summary.byStage.map((s) => s.stage)).toEqual(["Cold", "Warm", "Hot"]);
    expect(summary.byStage.map((s) => s.count)).toEqual([0, 1, 0]);
  });

  it("sums open value and excludes anything converted", () => {
    const summary = summariseProspects(
      [
        lead({ estimatedValue: 100_000 }),
        lead({ estimatedValue: 250_000 }),
        lead({ estimatedValue: 900_000, convertedTenderId: "t1" }),
      ],
      STAGES
    );
    expect(summary.openValue).toBe(350_000);
  });

  it("weights open value by each lead's own probability", () => {
    const summary = summariseProspects(
      [lead({ estimatedValue: 100_000, probability: 25 }), lead({ estimatedValue: 200_000, probability: 50 })],
      STAGES
    );
    expect(summary.weightedValue).toBe(125_000);
  });

  it("contributes nothing for a lead with no probability set, rather than its full value", () => {
    const summary = summariseProspects([lead({ estimatedValue: 400_000, probability: null })], STAGES);
    expect(summary.openValue).toBe(400_000);
    expect(summary.weightedValue).toBe(0);
  });

  it("treats a missing estimate as zero rather than breaking the sum", () => {
    const summary = summariseProspects([lead({ estimatedValue: null }), lead({ estimatedValue: 50_000 })], STAGES);
    expect(summary.openValue).toBe(50_000);
  });
});

describe("nextActionState", () => {
  const now = new Date("2026-07-26T09:00:00Z");

  it("reads an earlier date as overdue", () => {
    expect(nextActionState("2026-07-25T00:00:00Z", now)).toBe("overdue");
  });

  it("compares by calendar day, so this morning's action is not already overdue", () => {
    expect(nextActionState("2026-07-26T00:00:00Z", now)).toBe("today");
    expect(nextActionState("2026-07-26T23:00:00Z", now)).toBe("today");
  });

  it("reads a later date as upcoming", () => {
    expect(nextActionState("2026-07-27T00:00:00Z", now)).toBe("upcoming");
  });

  it("reports no action rather than guessing when nothing is scheduled", () => {
    expect(nextActionState(null, now)).toBe("none");
    expect(nextActionState("not-a-date", now)).toBe("none");
  });
});

describe("createProspectSchema", () => {
  it("accepts the CRM fields the vision doc asked for", () => {
    const parsed = createProspectSchema.safeParse({
      name: "Halcyon Developments",
      stage: "Warm",
      probability: 40,
      nextAction: "Call to confirm scope",
      nextActionDate: "2026-08-01",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.nextActionDate).toBeInstanceOf(Date);
  });

  it("rejects a probability outside 0-100 so a typo can't skew the weighted pipeline", () => {
    expect(createProspectSchema.safeParse({ name: "X", stage: "Cold", probability: 900 }).success).toBe(false);
    expect(createProspectSchema.safeParse({ name: "X", stage: "Cold", probability: -1 }).success).toBe(false);
  });

  it("rejects a fractional probability — it's a whole percent someone types", () => {
    expect(createProspectSchema.safeParse({ name: "X", stage: "Cold", probability: 42.5 }).success).toBe(false);
  });

  it("still requires a name and a stage", () => {
    expect(createProspectSchema.safeParse({ name: "", stage: "Cold" }).success).toBe(false);
    expect(createProspectSchema.safeParse({ name: "X", stage: "" }).success).toBe(false);
  });
});

describe("preference registry", () => {
  it("defaults the prospects register to the board", () => {
    expect(PREFERENCE_DEFAULTS["prospects.view"]).toBe("BOARD");
  });

  it("keeps a stored choice", () => {
    expect(parsePreference("prospects.view", "LIST")).toBe("LIST");
  });

  it("falls back rather than throwing on a value it doesn't recognise", () => {
    expect(parsePreference("prospects.view", "KANBAN")).toBe("BOARD");
    expect(parsePreference("prospects.view", null)).toBe("BOARD");
  });
});
