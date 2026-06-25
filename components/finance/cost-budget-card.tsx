"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CostBudgetCard({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");

  const { data } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return (await res.json()) as { project: { costBudget: number | null } };
    },
  });

  useEffect(() => {
    setValue(data?.project.costBudget != null ? String(data.project.costBudget) : "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costBudget: value ? Number(value) : null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save cost budget");
      }
    },
    onSuccess: () => {
      toast.success("Cost budget saved");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["finance", "financials", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Cost budget</CardTitle>
        <CardDescription>The internal budgeted cost — distinct from the contract sell value. Drives margin.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="cost-budget">Budgeted cost ($)</Label>
          <Input id="cost-budget" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
