"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type GanttViewPreferences = { showCriticalPath: boolean; criticalOnly: boolean; showBaseline: boolean };

const DEFAULTS: GanttViewPreferences = { showCriticalPath: true, criticalOnly: false, showBaseline: false };

type StoredWidget = { id: keyof GanttViewPreferences; visible: boolean };

function toPreferences(widgets: StoredWidget[] | null): GanttViewPreferences {
  if (!widgets) return DEFAULTS;
  const byId = new Map(widgets.map((w) => [w.id, w.visible]));
  return {
    showCriticalPath: byId.get("showCriticalPath") ?? DEFAULTS.showCriticalPath,
    criticalOnly: byId.get("criticalOnly") ?? DEFAULTS.criticalOnly,
    showBaseline: byId.get("showBaseline") ?? DEFAULTS.showBaseline,
  };
}

function toWidgets(prefs: GanttViewPreferences): StoredWidget[] {
  return [
    { id: "showCriticalPath", visible: prefs.showCriticalPath },
    { id: "criticalOnly", visible: prefs.criticalOnly },
    { id: "showBaseline", visible: prefs.showBaseline },
  ];
}

/**
 * Persists the Gantt's display toggles (critical path / critical-only /
 * baseline) per user, per project, through the same DashboardLayout storage
 * the dashboard customizer and register-table column menus use — a plain
 * `key -> boolean` preference is just a WidgetState[] where `visible` stands
 * in for the toggle's own on/off state rather than column visibility.
 */
export function useGanttViewPreferences(projectId: string) {
  const queryClient = useQueryClient();
  const pageKey = `gantt:${projectId}`;
  const queryKey = ["dashboard-layout", pageKey];

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/layout?dashboardKey=${encodeURIComponent(pageKey)}`);
      if (!res.ok) throw new Error("Failed to load Gantt view preferences");
      return (await res.json()) as { widgets: StoredWidget[] | null };
    },
  });

  const preferences = toPreferences(data?.widgets ?? null);

  const { mutate: persist } = useMutation({
    mutationFn: async (next: GanttViewPreferences) => {
      const res = await fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardKey: pageKey, widgets: toWidgets(next) }),
      });
      if (!res.ok) throw new Error("Failed to save Gantt view preferences");
      return (await res.json()) as { widgets: StoredWidget[] };
    },
    onSuccess: (result) => queryClient.setQueryData(queryKey, { widgets: result.widgets }),
  });

  function update(patch: Partial<GanttViewPreferences>) {
    persist({ ...preferences, ...patch });
  }

  return { preferences, update };
}
