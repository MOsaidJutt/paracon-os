import { describe, expect, it } from "vitest";
import { computeDelayDays, computeGanttStatus, ganttStatusColor } from "@/lib/schedule/gantt-status";

const TODAY = new Date("2026-07-26T00:00:00.000Z");
const AT_RISK_THRESHOLD = 2;

describe("computeGanttStatus", () => {
  it("is On Track when the current end date is still in the future", () => {
    const status = computeGanttStatus(
      { today: TODAY, currentEndDate: new Date("2026-07-30T00:00:00.000Z"), isComplete: false },
      AT_RISK_THRESHOLD
    );
    expect(status).toBe("On Track");
  });

  it("is On Track when the current end date reaches today exactly", () => {
    const status = computeGanttStatus(
      { today: TODAY, currentEndDate: TODAY, isComplete: false },
      AT_RISK_THRESHOLD
    );
    expect(status).toBe("On Track");
  });

  it("is At Risk when behind today by fewer than the threshold", () => {
    const status = computeGanttStatus(
      { today: TODAY, currentEndDate: new Date("2026-07-25T00:00:00.000Z"), isComplete: false },
      AT_RISK_THRESHOLD
    );
    expect(status).toBe("At Risk");
  });

  it("is Behind when behind today by the threshold or more", () => {
    const status = computeGanttStatus(
      { today: TODAY, currentEndDate: new Date("2026-07-24T00:00:00.000Z"), isComplete: false },
      AT_RISK_THRESHOLD
    );
    expect(status).toBe("Behind");
  });

  it("is Behind when heavily overdue", () => {
    const status = computeGanttStatus(
      { today: TODAY, currentEndDate: new Date("2026-06-01T00:00:00.000Z"), isComplete: false },
      AT_RISK_THRESHOLD
    );
    expect(status).toBe("Behind");
  });

  it("is always On Track once complete, even if the end date has long passed", () => {
    const status = computeGanttStatus(
      { today: TODAY, currentEndDate: new Date("2026-06-01T00:00:00.000Z"), isComplete: true },
      AT_RISK_THRESHOLD
    );
    expect(status).toBe("On Track");
  });

  it("respects a different org-configured threshold", () => {
    const status = computeGanttStatus(
      { today: TODAY, currentEndDate: new Date("2026-07-24T00:00:00.000Z"), isComplete: false },
      5
    );
    expect(status).toBe("At Risk");
  });
});

describe("computeDelayDays", () => {
  it("returns null when there is no baseline", () => {
    expect(computeDelayDays(null, new Date("2026-08-15T00:00:00.000Z"))).toBeNull();
  });

  it("returns positive days when the current date has slipped later than baseline", () => {
    const delay = computeDelayDays(new Date("2026-08-10T00:00:00.000Z"), new Date("2026-08-15T00:00:00.000Z"));
    expect(delay).toBe(5);
  });

  it("returns negative days when the current date is earlier than baseline", () => {
    const delay = computeDelayDays(new Date("2026-08-15T00:00:00.000Z"), new Date("2026-08-10T00:00:00.000Z"));
    expect(delay).toBe(-5);
  });

  it("returns zero when current matches baseline", () => {
    const delay = computeDelayDays(new Date("2026-08-10T00:00:00.000Z"), new Date("2026-08-10T00:00:00.000Z"));
    expect(delay).toBe(0);
  });
});

describe("ganttStatusColor", () => {
  it("maps each status to its RAG hex", () => {
    expect(ganttStatusColor("On Track")).toBe("#2E7D32");
    expect(ganttStatusColor("At Risk")).toBe("#ED9B11");
    expect(ganttStatusColor("Behind")).toBe("#C62828");
  });
});
