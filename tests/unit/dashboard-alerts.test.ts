import { describe, expect, it } from "vitest";
import { deriveComplianceAlerts, deriveShortageAlerts, sortAlerts } from "@/lib/dashboard/alerts";

describe("deriveShortageAlerts", () => {
  it("drops entries with no shortage", () => {
    const alerts = deriveShortageAlerts([{ role: "Carpenter", weekIndex: 0, gap: 0 }, { role: "Carpenter", weekIndex: 0, gap: -2 }]);
    expect(alerts).toHaveLength(0);
  });

  it("marks a current-week shortage red", () => {
    const [alert] = deriveShortageAlerts([{ role: "Carpenter", weekIndex: 0, gap: 2 }]);
    expect(alert.severity).toBe("red");
    expect(alert.detail).toContain("this week");
  });

  it("marks a future-week shortage amber", () => {
    const [alert] = deriveShortageAlerts([{ role: "Carpenter", weekIndex: 2, gap: 1 }]);
    expect(alert.severity).toBe("amber");
    expect(alert.detail).toContain("in 2 weeks");
  });

  it("links to the project when one is given, else to the forecast", () => {
    const [withProject] = deriveShortageAlerts([
      { projectId: "p1", projectName: "Forever", role: "Carpenter", weekIndex: 0, gap: 1 },
    ]);
    expect(withProject.href).toBe("/projects/p1");
    expect(withProject.detail).toContain("Forever");

    const [orgWide] = deriveShortageAlerts([{ role: "Carpenter", weekIndex: 0, gap: 1 }]);
    expect(orgWide.href).toBe("/forecast");
    expect(orgWide.detail).toContain("Org-wide");
  });
});

describe("deriveComplianceAlerts", () => {
  it("marks Expired red and Expiring amber", () => {
    const alerts = deriveComplianceAlerts([
      { id: "c1", workerId: "w1", workerName: "Marcus Webb", type: "White Card", status: "Expired", expiryDate: null },
      { id: "c2", workerId: "w2", workerName: "Daniel Okafor", type: "White Card", status: "Expiring", expiryDate: null },
    ]);
    expect(alerts[0].severity).toBe("red");
    expect(alerts[1].severity).toBe("amber");
  });

  it("links to the worker's labour record", () => {
    const [alert] = deriveComplianceAlerts([
      { id: "c1", workerId: "w1", workerName: "Marcus Webb", type: "White Card", status: "Expired", expiryDate: null },
    ]);
    expect(alert.href).toBe("/labour/w1");
  });
});

describe("sortAlerts", () => {
  it("orders red before amber", () => {
    const sorted = sortAlerts([
      { id: "a", type: "compliance", severity: "amber", title: "", detail: "", href: "" },
      { id: "b", type: "shortage", severity: "red", title: "", detail: "", href: "" },
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("is stable for alerts of the same severity", () => {
    const sorted = sortAlerts([
      { id: "a", type: "compliance", severity: "red", title: "", detail: "", href: "" },
      { id: "b", type: "shortage", severity: "red", title: "", detail: "", href: "" },
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["a", "b"]);
  });
});
