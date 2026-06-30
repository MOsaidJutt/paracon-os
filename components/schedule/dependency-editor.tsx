"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type DependencyRow = {
  id: string;
  predecessorId: string;
  successorId: string;
  type: "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH" | "START_TO_FINISH";
  lagDays: number;
};

const TYPE_LABELS: Record<DependencyRow["type"], string> = {
  FINISH_TO_START: "Finish to Start",
  START_TO_START: "Start to Start",
  FINISH_TO_FINISH: "Finish to Finish",
  START_TO_FINISH: "Start to Finish",
};

export function DependencyEditor({
  projectId,
  activityId,
  otherActivities,
}: {
  projectId: string;
  activityId: string;
  otherActivities: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [predecessorId, setPredecessorId] = useState<string>("");
  const [type, setType] = useState<DependencyRow["type"]>("FINISH_TO_START");
  const [lagDays, setLagDays] = useState(0);

  const { data } = useQuery({
    queryKey: ["projects", projectId, "dependencies"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/dependencies`);
      if (!res.ok) throw new Error("Failed to load dependencies");
      return (await res.json()) as { dependencies: DependencyRow[] };
    },
  });

  const nameById = new Map(otherActivities.map((a) => [a.id, a.name]));
  const related = (data?.dependencies ?? []).filter((d) => d.predecessorId === activityId || d.successorId === activityId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "dependencies"] });
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "activities"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorId, successorId: activityId, type, lagDays }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add dependency");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Dependency added");
      setPredecessorId("");
      setLagDays(0);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (dependencyId: string) => {
      const res = await fetch(`/api/projects/${projectId}/dependencies/${dependencyId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to remove dependency");
      }
    },
    onSuccess: () => {
      toast.success("Dependency removed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-2">
      {related.length === 0 && <p className="text-xs text-muted-foreground">No dependencies on this task yet.</p>}

      {related.map((d) => {
        const isPredecessor = d.predecessorId === activityId;
        const otherId = isPredecessor ? d.successorId : d.predecessorId;
        return (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-xs">
            <span>
              {isPredecessor ? "Drives" : "Driven by"} <span className="font-medium text-foreground">{nameById.get(otherId) ?? otherId}</span>
              <span className="ml-1.5 text-muted-foreground">
                ({TYPE_LABELS[d.type]}{d.lagDays !== 0 ? `, ${d.lagDays > 0 ? "+" : ""}${d.lagDays}d` : ""})
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(d.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      })}

      <div className="mt-1 flex flex-wrap items-end gap-2">
        <Select value={predecessorId} onValueChange={setPredecessorId}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Depends on..." />
          </SelectTrigger>
          <SelectContent>
            {otherActivities
              .filter((a) => a.id !== activityId)
              .map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={(v) => setType(v as DependencyRow["type"])}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          className="h-8 w-20 text-xs"
          value={lagDays}
          onChange={(e) => setLagDays(Number(e.target.value))}
          placeholder="Lag (d)"
        />

        <Button
          size="sm"
          variant="outline"
          disabled={!predecessorId || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <Plus className="size-3.5" />
          Add dependency
        </Button>
      </div>
    </div>
  );
}
