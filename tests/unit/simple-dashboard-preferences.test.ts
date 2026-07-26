import { describe, expect, it } from "vitest";
import {
  DEFAULT_KPI_SLOTS,
  RING_SLOT_COUNT,
  availableKpiSlots,
  resolveKpiSlots,
} from "@/lib/dashboard/kpi-slots";
import { buildChecklist, periodKeyFor, activePeriodKeys } from "@/lib/dashboard/checklist";
import { parseViewMode, DEFAULT_VIEW_MODE } from "@/lib/view-mode";

describe("resolveKpiSlots", () => {
  it("falls back to the defaults for a user who has never customised", () => {
    expect(resolveKpiSlots(null)).toEqual(DEFAULT_KPI_SLOTS);
    expect(resolveKpiSlots(undefined)).toEqual(DEFAULT_KPI_SLOTS);
  });

  it("keeps a saved choice", () => {
    const saved = ["win-rate-count", "submission-rate", "compliance-current", "projects-on-track"];
    expect(resolveKpiSlots(saved)).toEqual(saved);
  });

  it("drops an id the catalogue no longer knows and back-fills from the defaults", () => {
    const result = resolveKpiSlots(["compliance-current", "retired-metric", "win-rate-count"]);
    expect(result).toHaveLength(RING_SLOT_COUNT);
    expect(result).not.toContain("retired-metric");
    expect(result.slice(0, 2)).toEqual(["compliance-current", "win-rate-count"]);
  });

  it("never returns the same metric twice, even if it was saved twice", () => {
    const result = resolveKpiSlots(["win-rate-value", "win-rate-value", "win-rate-value"]);
    expect(new Set(result).size).toBe(RING_SLOT_COUNT);
  });

  it("ignores junk in the stored preference rather than throwing", () => {
    expect(resolveKpiSlots("not-an-array")).toEqual(DEFAULT_KPI_SLOTS);
    expect(resolveKpiSlots({ slots: [] })).toEqual(DEFAULT_KPI_SLOTS);
    expect(resolveKpiSlots([1, 2, 3])).toEqual(DEFAULT_KPI_SLOTS);
  });

  it("always returns exactly four slots", () => {
    expect(resolveKpiSlots([])).toHaveLength(RING_SLOT_COUNT);
    expect(resolveKpiSlots(["win-rate-value"])).toHaveLength(RING_SLOT_COUNT);
  });

  it("back-fills a full row from what a restricted role can see, not a half-empty one", () => {
    // An estimator's defaults include two metrics they can't see. Dropping
    // them without back-filling would leave two rings instead of four.
    const estimatorSlots = availableKpiSlots(["tender.view"]).map((slot) => slot.id);
    const result = resolveKpiSlots(null, estimatorSlots);

    expect(result).toHaveLength(RING_SLOT_COUNT);
    expect(result.every((id) => estimatorSlots.includes(id))).toBe(true);
    expect(result).not.toContain("labour-utilisation");
  });

  it("never hands back a metric the role isn't cleared for, even if it was saved earlier", () => {
    const estimatorSlots = availableKpiSlots(["tender.view"]).map((slot) => slot.id);
    const result = resolveKpiSlots(["labour-utilisation", "compliance-current"], estimatorSlots);

    expect(result).not.toContain("labour-utilisation");
    expect(result).not.toContain("compliance-current");
  });

  it("returns fewer than four only when the role can see fewer than four", () => {
    const result = resolveKpiSlots(null, ["revenue-won", "win-rate-value"]);
    expect(result).toEqual(["revenue-won", "win-rate-value"]);
  });
});

describe("availableKpiSlots", () => {
  it("offers only metrics the user's permissions cover", () => {
    const estimator = availableKpiSlots(["tender.view"]).map((slot) => slot.id);
    expect(estimator).toContain("revenue-won");
    expect(estimator).not.toContain("labour-utilisation");
    expect(estimator).not.toContain("compliance-current");
  });

  it("offers nothing to a user with no relevant permissions", () => {
    expect(availableKpiSlots(["site.update"])).toEqual([]);
  });
});

describe("periodKeyFor", () => {
  it("buckets a daily item by calendar date", () => {
    expect(periodKeyFor("DAILY", new Date("2026-07-25T09:00:00Z"))).toBe("2026-07-25");
  });

  it("buckets a weekly item by its ISO week's Monday", () => {
    // Sat 25 Jul 2026 and Mon 20 Jul 2026 are the same ISO week.
    expect(periodKeyFor("WEEKLY", new Date("2026-07-25T09:00:00Z"))).toBe("W2026-07-20");
    expect(periodKeyFor("WEEKLY", new Date("2026-07-20T09:00:00Z"))).toBe("W2026-07-20");
  });

  it("moves a weekly item to a new bucket once the week turns over", () => {
    const sunday = periodKeyFor("WEEKLY", new Date("2026-07-26T09:00:00Z"));
    const monday = periodKeyFor("WEEKLY", new Date("2026-07-27T09:00:00Z"));
    expect(sunday).toBe("W2026-07-20");
    expect(monday).toBe("W2026-07-27");
  });
});

describe("buildChecklist", () => {
  const items = [
    { key: "site-updates", label: "Review site updates", cadence: "DAILY" as const },
    { key: "forecast", label: "Review the labour forecast", cadence: "WEEKLY" as const },
  ];
  const now = new Date("2026-07-25T09:00:00Z");

  it("marks an item done when a tick exists for its current period", () => {
    const result = buildChecklist(items, [{ itemKey: "site-updates", periodKey: "2026-07-25" }], now);
    expect(result.find((i) => i.key === "site-updates")?.done).toBe(true);
    expect(result.find((i) => i.key === "forecast")?.done).toBe(false);
  });

  it("ignores yesterday's tick, so a daily item clears itself overnight", () => {
    const result = buildChecklist(items, [{ itemKey: "site-updates", periodKey: "2026-07-24" }], now);
    expect(result.find((i) => i.key === "site-updates")?.done).toBe(false);
  });

  it("does not let a daily-shaped tick satisfy a weekly item", () => {
    const result = buildChecklist(items, [{ itemKey: "forecast", periodKey: "2026-07-25" }], now);
    expect(result.find((i) => i.key === "forecast")?.done).toBe(false);
  });

  it("carries each item's own period key through for the client to write back", () => {
    const result = buildChecklist(items, [], now);
    expect(result.find((i) => i.key === "site-updates")?.periodKey).toBe("2026-07-25");
    expect(result.find((i) => i.key === "forecast")?.periodKey).toBe("W2026-07-20");
  });

  it("returns nothing when an org has cleared its checklist", () => {
    expect(buildChecklist([], [], now)).toEqual([]);
  });
});

describe("activePeriodKeys", () => {
  it("covers both cadences in one query", () => {
    expect(activePeriodKeys(new Date("2026-07-25T09:00:00Z"))).toEqual(["2026-07-25", "W2026-07-20"]);
  });
});

describe("parseViewMode", () => {
  it("defaults to the simplified view for anyone who has never toggled", () => {
    expect(parseViewMode(undefined)).toBe("SIMPLE");
    expect(parseViewMode(null)).toBe(DEFAULT_VIEW_MODE);
  });

  it("keeps a stored choice", () => {
    expect(parseViewMode("FULL")).toBe("FULL");
    expect(parseViewMode("SIMPLE")).toBe("SIMPLE");
  });

  it("falls back rather than throwing on a value it doesn't recognise", () => {
    expect(parseViewMode("ADVANCED")).toBe("SIMPLE");
    expect(parseViewMode(42)).toBe("SIMPLE");
  });
});
