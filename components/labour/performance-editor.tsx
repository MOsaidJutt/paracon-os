"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PerformanceScores } from "./performance-radar";

const METRICS: { key: keyof PerformanceScores; label: string }[] = [
  { key: "quality", label: "Quality" },
  { key: "reliability", label: "Reliability" },
  { key: "productivity", label: "Productivity" },
  { key: "safety", label: "Safety" },
];

export function PerformanceEditor({ workerId, initial }: { workerId: string; initial: PerformanceScores }) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<PerformanceScores>(initial);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workers/${workerId}/performance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scores),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Performance updated");
      queryClient.invalidateQueries({ queryKey: ["labour"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-4">
      {METRICS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>{label}</Label>
            <span className="text-sm text-muted-foreground">{scores[key].toFixed(1)} / 5</span>
          </div>
          <Slider
            min={0}
            max={5}
            step={0.5}
            value={[scores[key]]}
            onValueChange={([value]) => setScores((prev) => ({ ...prev, [key]: value }))}
          />
        </div>
      ))}
      <Button size="sm" className="self-start" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Save scores"}
      </Button>
    </div>
  );
}
