"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Unlock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type MetricConfig = { key: string; label: string; weight: number; scaleMax: number; source: "AUTO" | "MANUAL" };
type StaffScore = {
  id: string | null;
  metricScoresJson: Record<string, number>;
  overallScore: number;
  lockedAt: string | null;
  note: string | null;
};

export function ScorecardAssessSheet({
  open,
  onOpenChange,
  workerId,
  workerName,
  period,
  canAssess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  workerName: string;
  period: string;
  canAssess: boolean;
}) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["scorecard", "worker", workerId, period],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/scorecard/${workerId}?period=${period}`);
      if (!res.ok) throw new Error("Failed to load scorecard");
      return (await res.json()) as { metrics: MetricConfig[]; score: StaffScore };
    },
  });

  useEffect(() => {
    if (data) {
      setScores(data.score.metricScoresJson);
      setNote(data.score.note ?? "");
    }
  }, [data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["scorecard"] });
    queryClient.invalidateQueries({ queryKey: ["scorecard", "worker", workerId, period] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/scorecard/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, metricScores: scores, note: note || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Score saved");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lock = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/scorecard/${workerId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Lock failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Month locked");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unlock = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/scorecard/${workerId}/lock?period=${period}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Unlock failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Month unlocked");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const locked = !!data?.score.lockedAt;
  const readOnly = !canAssess || locked;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {workerName}
            {locked && (
              <Badge variant="outline">
                <Lock className="mr-1 size-3" />
                Locked
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>{period} assessment. Auto metrics are computed from daily updates and allocations.</SheetDescription>
        </SheetHeader>

        {isLoading || !data ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="mt-4 flex flex-col gap-5">
            {data.metrics.map((metric) => (
              <div key={metric.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    {metric.label}
                    <Badge variant="secondary" className="text-[10px]">
                      {metric.source === "AUTO" ? "Auto" : "Manual"}
                    </Badge>
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {(scores[metric.key] ?? 0).toFixed(1)} / {metric.scaleMax}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={metric.scaleMax}
                  step={0.5}
                  disabled={readOnly || metric.source === "AUTO"}
                  value={[scores[metric.key] ?? 0]}
                  onValueChange={([value]) => setScores((prev) => ({ ...prev, [metric.key]: value }))}
                />
              </div>
            ))}

            <div className="flex flex-col gap-1.5">
              <Label>Note</Label>
              <Textarea
                rows={3}
                disabled={readOnly}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional context for this month's assessment"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm font-medium">Overall score</span>
              <span className="text-lg font-semibold text-foreground">{data.score.overallScore.toFixed(1)}</span>
            </div>
          </div>
        )}

        {canAssess && (
          <SheetFooter className="mt-4 flex-row gap-2">
            {!locked ? (
              <>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Saving..." : "Save"}
                </Button>
                {data?.score.id && (
                  <Button variant="outline" onClick={() => lock.mutate()} disabled={lock.isPending}>
                    <Lock className="size-4" />
                    Lock month
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" onClick={() => unlock.mutate()} disabled={unlock.isPending}>
                <Unlock className="size-4" />
                Unlock to edit
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
