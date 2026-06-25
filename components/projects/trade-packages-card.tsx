"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TradePackage = { name: string; contractValue: number };

/**
 * The contracted trade breakdown (e.g. Partitions/Doors/Ceiling + value) —
 * entered once here, then reused by both the Tender Letter's TENDER PRICE
 * rows and the Progress Claim's CONTRACT WORK rows. Lives on the Documents
 * tab (rather than the generic project edit sheet) since that's where it's
 * actually needed, right next to "Generate document".
 */
export function TradePackagesCard({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TradePackage[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return (await res.json()) as { project: { tradePackages: TradePackage[] | null } };
    },
  });

  useEffect(() => {
    if (data && !dirty) setDraft(data.project.tradePackages ?? []);
  }, [data, dirty]);

  const save = useMutation({
    mutationFn: async (tradePackages: TradePackage[]) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradePackages }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save trade packages");
      }
    },
    onSuccess: () => {
      toast.success("Trade packages saved");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function updateRow(index: number, patch: Partial<TradePackage>) {
    setDirty(true);
    setDraft((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setDirty(true);
    setDraft((rows) => [...rows, { name: "", contractValue: 0 }]);
  }

  function removeRow(index: number) {
    setDirty(true);
    setDraft((rows) => rows.filter((_, i) => i !== index));
  }

  const canSave = draft.every((r) => r.name.trim());

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Trade Packages</CardTitle>
        <CardDescription>
          The contracted trade breakdown for this project — feeds the Tender Letter&apos;s pricing rows and the
          Progress Claim&apos;s Contract Work rows. Enter once here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <div className="h-10 animate-pulse rounded-md bg-muted/40" />
        ) : (
          <>
            {draft.length === 0 && <p className="text-sm text-muted-foreground">No trade packages yet.</p>}
            {draft.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  {i === 0 && <Label htmlFor={`trade-name-${i}`}>Trade</Label>}
                  <Input
                    id={`trade-name-${i}`}
                    placeholder="e.g. Partitions"
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                  />
                </div>
                <div className="flex w-40 flex-col gap-1.5">
                  {i === 0 && <Label htmlFor={`trade-value-${i}`}>Contract value ($)</Label>}
                  <Input
                    id={`trade-value-${i}`}
                    type="number"
                    min={0}
                    value={row.contractValue || ""}
                    onChange={(e) => updateRow(i, { contractValue: Number(e.target.value) })}
                  />
                </div>
                <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => removeRow(i)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="size-4" />
                Add trade
              </Button>
              {dirty && (
                <Button size="sm" disabled={!canSave || save.isPending} onClick={() => save.mutate(draft)}>
                  {save.isPending ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
