import { describe, expect, it } from "vitest";
import { assertAllocatable, findDoubleBooking, isComplianceExpired } from "@/lib/labour/allocation";
import { ConflictError } from "@/lib/errors";

const WEEK_1 = new Date("2026-06-22T00:00:00.000Z");
const WEEK_2 = new Date("2026-06-29T00:00:00.000Z");

describe("isComplianceExpired", () => {
  it("is false with no compliance records", () => {
    expect(isComplianceExpired([])).toBe(false);
  });

  it("is false when every record is Valid or Expiring", () => {
    expect(
      isComplianceExpired([
        { type: "White Card", status: "Valid", expiryDate: null },
        { type: "Ticket", status: "Expiring", expiryDate: null },
      ])
    ).toBe(false);
  });

  it("is true when any record is Expired, even alongside Valid ones", () => {
    expect(
      isComplianceExpired([
        { type: "White Card", status: "Valid", expiryDate: null },
        { type: "Ticket", status: "Expired", expiryDate: null },
      ])
    ).toBe(true);
  });
});

describe("findDoubleBooking", () => {
  it("returns null when the worker has no allocation that week", () => {
    const existing = [{ id: "a1", projectId: "proj-1", weekStart: WEEK_2 }];
    expect(findDoubleBooking(existing, WEEK_1)).toBeNull();
  });

  it("finds a clash on the same week regardless of project", () => {
    const existing = [{ id: "a1", projectId: "proj-1", weekStart: WEEK_1 }];
    expect(findDoubleBooking(existing, WEEK_1)?.id).toBe("a1");
  });

  it("returns null on an empty existing list", () => {
    expect(findDoubleBooking([], WEEK_1)).toBeNull();
  });
});

describe("assertAllocatable", () => {
  it("allows an allocation with valid compliance and no clash", () => {
    expect(() =>
      assertAllocatable({ compliance: [{ type: "White Card", status: "Valid", expiryDate: null }], existing: [], weekStart: WEEK_1, projectId: "proj-1" })
    ).not.toThrow();
  });

  it("allows an allocation when compliance is only Expiring", () => {
    expect(() =>
      assertAllocatable({
        compliance: [{ type: "Ticket", status: "Expiring", expiryDate: null }],
        existing: [],
        weekStart: WEEK_1,
        projectId: "proj-1",
      })
    ).not.toThrow();
  });

  it("blocks an allocation when any compliance record is Expired", () => {
    expect(() =>
      assertAllocatable({
        compliance: [{ type: "Ticket", status: "Expired", expiryDate: null }],
        existing: [],
        weekStart: WEEK_1,
        projectId: "proj-1",
      })
    ).toThrow(ConflictError);
  });

  it("blocks double-booking the same week on a different project", () => {
    expect(() =>
      assertAllocatable({
        compliance: [],
        existing: [{ id: "a1", projectId: "proj-2", weekStart: WEEK_1 }],
        weekStart: WEEK_1,
        projectId: "proj-1",
      })
    ).toThrow(ConflictError);
  });

  it("blocks a duplicate allocation to the same project/week", () => {
    expect(() =>
      assertAllocatable({
        compliance: [],
        existing: [{ id: "a1", projectId: "proj-1", weekStart: WEEK_1 }],
        weekStart: WEEK_1,
        projectId: "proj-1",
      })
    ).toThrow(ConflictError);
  });

  it("allows the same worker on different weeks across different projects", () => {
    expect(() =>
      assertAllocatable({
        compliance: [],
        existing: [{ id: "a1", projectId: "proj-2", weekStart: WEEK_2 }],
        weekStart: WEEK_1,
        projectId: "proj-1",
      })
    ).not.toThrow();
  });

  it("checks compliance before the double-booking clash", () => {
    expect(() =>
      assertAllocatable({
        compliance: [{ type: "Ticket", status: "Expired", expiryDate: null }],
        existing: [{ id: "a1", projectId: "proj-2", weekStart: WEEK_1 }],
        weekStart: WEEK_1,
        projectId: "proj-1",
      })
    ).toThrow(/expired compliance/i);
  });
});
