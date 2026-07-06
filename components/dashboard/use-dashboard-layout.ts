"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resolveDashboardLayout, type DashboardKey, type WidgetState } from "@/lib/dashboard/widget-registry";

/**
 * Loads/saves a user's dashboard customisation (order + visibility) against
 * /api/dashboard/layout, backed by the DashboardLayout table. Edits are kept
 * in local `draft` state while `editing` and only PUT to the server on
 * `finishEditing`, so a user can rearrange freely and only "spend" a write
 * once.
 */
export function useDashboardLayout(dashboardKey: DashboardKey) {
  const queryClient = useQueryClient();
  const queryKey = ["dashboard-layout", dashboardKey];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WidgetState[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/layout?dashboardKey=${dashboardKey}`);
      if (!res.ok) throw new Error("Failed to load dashboard layout");
      return (await res.json()) as { widgets: WidgetState[] | null };
    },
  });

  const savedLayout = resolveDashboardLayout(dashboardKey, data?.widgets ?? null);

  const { mutate: persist, isPending: isSaving } = useMutation({
    mutationFn: async (widgets: WidgetState[]) => {
      const res = await fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardKey, widgets }),
      });
      if (!res.ok) throw new Error("Failed to save dashboard layout");
      return (await res.json()) as { widgets: WidgetState[] };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, { widgets: result.widgets });
    },
  });

  function startEditing() {
    setDraft(savedLayout);
    setEditing(true);
  }

  function finishEditing() {
    if (draft) persist(draft);
    setEditing(false);
  }

  return {
    layout: editing && draft ? draft : savedLayout,
    isLoading,
    editing,
    draft,
    setDraft,
    startEditing,
    finishEditing,
    isSaving,
  };
}
