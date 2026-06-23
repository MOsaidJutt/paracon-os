"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Manual trigger for the hourly forecast recompute — sends the same Inngest event the cron fires. */
export function RecomputeForecastButton() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/forecast/recompute", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Recompute failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecast"] });
      toast.success("Forecast recomputed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button variant="outline" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      <RefreshCw className="size-4" />
      {mutation.isPending ? "Recomputing..." : "Recompute forecast"}
    </Button>
  );
}
