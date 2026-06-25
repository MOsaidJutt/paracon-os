"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Manual trigger for the monthly productivity recompute — sends the same Inngest event the cron fires. */
export function RecomputeProductivityButton() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/labour/productivity/recompute", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Recompute failed");
      }
      return (await res.json()) as { recordsUpserted: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["productivity"] });
      toast.success(`Productivity recomputed — ${data.recordsUpserted} record(s) updated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button variant="outline" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      <RefreshCw className="size-4" />
      {mutation.isPending ? "Recomputing..." : "Recompute this month"}
    </Button>
  );
}
