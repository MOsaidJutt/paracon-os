"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Shared add/remove allocation mutations — used by both the drag-drop path and the click-to-add picker. */
export function useAllocationMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["allocations", "project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["allocations", "workers"] });
  };

  const addMutation = useMutation({
    mutationFn: async (input: { workerId: string; weekStart: string; role: string }) => {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: input.workerId, projectId, weekStart: input.weekStart, role: input.role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not allocate worker");
      }
      return res.json();
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      const res = await fetch(`/api/allocations/${allocationId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not remove allocation");
      }
      return res.json();
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return { addMutation, removeMutation };
}
