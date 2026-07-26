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

  const { mutateAsync: persist, isPending: isSaving } = useMutation({
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

  /**
   * Awaits the write before leaving edit mode. Fire-and-forget loses the
   * layout outright if the user reloads or navigates in the moment after
   * clicking Save: the request is cancelled mid-flight (ECONNRESET) and
   * nothing says so. Callers may ignore the returned promise; those that
   * close a panel on save should await it.
   *
   * `next` lets a caller hand in the layout it is actually displaying rather
   * than trusting this hook's `draft` to be current. An editor that lives in a
   * separate component and saves through a prop can otherwise call a closure
   * captured before its last edit, and the write is silently skipped — which
   * is exactly what happened to the simplified dashboard's customise panel:
   * the ring preference saved, the widget layout did not, and nothing errored.
   */
  async function finishEditing(next?: WidgetState[]) {
    const pending = next ?? draft;
    if (pending) await persist(pending);
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
