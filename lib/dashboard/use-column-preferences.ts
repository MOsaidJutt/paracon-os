"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resolveLayout, type DashboardWidgetMeta, type WidgetState } from "./widget-registry";

/**
 * Per-user column show/hide + order for a register table (or any other
 * arbitrary per-page view), persisted through the SAME DashboardLayout
 * storage and /api/dashboard/layout API the dashboard widget customizer
 * uses — `pageKey` is just a different DashboardLayout.dashboardKey value
 * (e.g. "register:tenders", "gantt:<projectId>") than "director"/"pm".
 */
export function useColumnPreferences(pageKey: string, defaultColumns: DashboardWidgetMeta[]) {
  const queryClient = useQueryClient();
  const queryKey = ["dashboard-layout", pageKey];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/layout?dashboardKey=${encodeURIComponent(pageKey)}`);
      if (!res.ok) throw new Error("Failed to load column preferences");
      return (await res.json()) as { widgets: WidgetState[] | null };
    },
  });

  const columns = resolveLayout(defaultColumns, data?.widgets ?? null);

  const { mutate: persist, isPending: isSaving } = useMutation({
    mutationFn: async (next: WidgetState[]) => {
      const res = await fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardKey: pageKey, widgets: next }),
      });
      if (!res.ok) throw new Error("Failed to save column preferences");
      return (await res.json()) as { widgets: WidgetState[] };
    },
    onSuccess: (result) => queryClient.setQueryData(queryKey, { widgets: result.widgets }),
  });

  function toggleColumn(id: string) {
    persist(columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }

  function reorderColumns(next: WidgetState[]) {
    persist(next);
  }

  return { columns, isLoading, isSaving, toggleColumn, reorderColumns };
}
