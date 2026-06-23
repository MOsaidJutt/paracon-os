"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ComplianceChange = { id: string; workerId: string; type: string; before: string; after: string };

/** Manual trigger for the nightly compliance recompute — sends the same Inngest event the cron fires. */
export function RecomputeComplianceButton() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/labour/compliance/recompute", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Recompute failed");
      }
      return (await res.json()) as { changes: ComplianceChange[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["labour"] });
      toast.success(
        data.changes.length > 0
          ? `Compliance recomputed — ${data.changes.length} status change(s)`
          : "Compliance recomputed — no changes"
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button variant="outline" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      <RefreshCw className="size-4" />
      {mutation.isPending ? "Recomputing..." : "Recompute compliance"}
    </Button>
  );
}
