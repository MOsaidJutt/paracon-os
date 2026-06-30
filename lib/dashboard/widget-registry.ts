export type DashboardKey = "director" | "pm";

export type DashboardWidgetMeta = { id: string; title: string };

/**
 * Single source of truth for which widgets exist per dashboard and their
 * default order/title. Consumed by both the dashboard renderer and the
 * "Customize" edit panel — adding a widget here is the only code change
 * needed; visibility/order after that is user data (DashboardLayout), not code.
 */
export const DASHBOARD_WIDGETS: Record<DashboardKey, DashboardWidgetMeta[]> = {
  director: [
    { id: "project-health", title: "Project health" },
    { id: "at-risk", title: "At-risk projects" },
    { id: "pipeline", title: "Pipeline snapshot" },
    { id: "capacity", title: "Can we take on more work?" },
    { id: "alerts", title: "Alerts" },
    { id: "critical-dates", title: "Critical dates" },
    { id: "scorecard", title: "Staff scorecard" },
  ],
  pm: [
    { id: "my-projects", title: "My projects" },
    { id: "lookahead", title: "3-week look-ahead" },
    { id: "labour-chart", title: "Labour required vs allocated" },
    { id: "deliveries", title: "Delivery status" },
    { id: "open-issues", title: "Open issues" },
    { id: "alerts", title: "Alerts" },
    { id: "scorecard", title: "Staff scorecard" },
  ],
};

export type WidgetState = { id: string; visible: boolean };

/**
 * Merges a saved layout with the registry default: keeps the user's chosen
 * order/visibility for widgets that still exist, appends any newly-added
 * registry widget as visible, and drops ids the registry no longer knows
 * about. With no saved layout, returns the registry default (all visible,
 * declared order).
 */
export function resolveLayout(dashboardKey: DashboardKey, saved: WidgetState[] | null | undefined): WidgetState[] {
  const registry = DASHBOARD_WIDGETS[dashboardKey];
  const registryIds = new Set(registry.map((w) => w.id));

  if (!saved || saved.length === 0) {
    return registry.map((w) => ({ id: w.id, visible: true }));
  }

  const known = saved.filter((w) => registryIds.has(w.id));
  const knownIds = new Set(known.map((w) => w.id));
  const missing = registry.filter((w) => !knownIds.has(w.id)).map((w) => ({ id: w.id, visible: true }));
  return [...known, ...missing];
}
