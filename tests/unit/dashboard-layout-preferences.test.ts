import { describe, expect, it } from "vitest";
import { dashboardKeySchema } from "@/lib/validations/dashboard-layout";
import { resolveDashboardLayout, resolveLayout, type DashboardWidgetMeta } from "@/lib/dashboard/widget-registry";

describe("dashboardKeySchema", () => {
  it("still accepts the two named dashboards", () => {
    expect(dashboardKeySchema.safeParse("director").success).toBe(true);
    expect(dashboardKeySchema.safeParse("pm").success).toBe(true);
  });

  it("accepts generalized register/gantt keys with colons and dashes", () => {
    expect(dashboardKeySchema.safeParse("register:tenders").success).toBe(true);
    expect(dashboardKeySchema.safeParse("gantt:ckabc123-def").success).toBe(true);
  });

  it("rejects an empty key", () => {
    expect(dashboardKeySchema.safeParse("").success).toBe(false);
  });

  it("rejects a key with unsafe characters", () => {
    expect(dashboardKeySchema.safeParse("register/tenders; DROP TABLE").success).toBe(false);
    expect(dashboardKeySchema.safeParse("register tenders").success).toBe(false);
  });

  it("rejects a key over the length limit", () => {
    expect(dashboardKeySchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("resolveLayout (generic registry)", () => {
  const REGISTRY: DashboardWidgetMeta[] = [
    { id: "project", title: "Project" },
    { id: "client", title: "Client" },
    { id: "status", title: "Status" },
  ];

  it("returns every registry entry visible, in declared order, with no saved layout", () => {
    expect(resolveLayout(REGISTRY, null)).toEqual([
      { id: "project", visible: true },
      { id: "client", visible: true },
      { id: "status", visible: true },
    ]);
  });

  it("keeps the saved order and visibility for entries that still exist", () => {
    const saved = [
      { id: "status", visible: false },
      { id: "project", visible: true },
    ];
    expect(resolveLayout(REGISTRY, saved)).toEqual([
      { id: "status", visible: false },
      { id: "project", visible: true },
      { id: "client", visible: true }, // newly appeared in the registry, appended as visible
    ]);
  });

  it("drops a saved id the registry no longer knows about", () => {
    const saved = [
      { id: "project", visible: true },
      { id: "retired-column", visible: true },
    ];
    const result = resolveLayout(REGISTRY, saved);
    expect(result.find((w) => w.id === "retired-column")).toBeUndefined();
  });
});

describe("resolveDashboardLayout", () => {
  it("resolves against the named dashboard's own registry", () => {
    const result = resolveDashboardLayout("director", null);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((w) => w.visible)).toBe(true);
  });
});
