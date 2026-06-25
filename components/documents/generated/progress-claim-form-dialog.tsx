"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { generatedDocumentsQueryParam, type GeneratedDocumentRow } from "./types";

type TradePackage = { name: string; contractValue: number };

type ContractWorkLineForm = { name: string; contractValue: number; percentCompleted: number };
type VariationLineForm = { generatedDocumentId: string; number: string; amount: number; included: boolean; percentCompleted: number };

export function ProgressClaimFormDialog({
  open,
  onOpenChange,
  projectId,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existing?: GeneratedDocumentRow | null;
}) {
  const queryClient = useQueryClient();
  const [contractWorkLines, setContractWorkLines] = useState<ContractWorkLineForm[]>([]);
  const [variationLines, setVariationLines] = useState<VariationLineForm[]>([]);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return (await res.json()) as { project: { tradePackages: TradePackage[] | null } };
    },
  });

  const { data: generatedDocs } = useQuery({
    queryKey: ["generated-documents", { projectId }],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/documents/generated?${generatedDocumentsQueryParam({ projectId })}`);
      if (!res.ok) throw new Error("Failed to load generated documents");
      return (await res.json()) as { documents: GeneratedDocumentRow[] };
    },
  });

  const variationDocs = (generatedDocs?.documents ?? []).filter((d) => d.type === "VARIATION");

  useEffect(() => {
    if (!open) return;
    const tradePackages = project?.project.tradePackages ?? [];
    const existingSnapshot = existing?.dataSnapshotJson as
      | { contractWorkLines: { name: string; percentCompleted: number }[]; variationLines: { name: string; percentCompleted: number }[] }
      | undefined;

    setContractWorkLines(
      tradePackages.map((tp) => ({
        name: tp.name,
        contractValue: tp.contractValue,
        percentCompleted: existingSnapshot?.contractWorkLines.find((l) => l.name === tp.name)?.percentCompleted ?? 0,
      }))
    );

    setVariationLines(
      variationDocs.map((doc) => {
        const snapshot = doc.dataSnapshotJson as unknown as { totals: { totalExGst: number } };
        const existingLine = existingSnapshot?.variationLines.find((l) => l.name === doc.number);
        return {
          generatedDocumentId: doc.id,
          number: doc.number,
          amount: snapshot.totals.totalExGst,
          included: !!existingLine,
          percentCompleted: existingLine?.percentCompleted ?? 100,
        };
      })
    );
    // variationDocs is derived from generatedDocs, intentionally excluded to avoid re-running on every list refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project, existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        contractWorkLines: contractWorkLines.map((l) => ({ name: l.name, percentCompleted: l.percentCompleted })),
        variationLines: variationLines
          .filter((l) => l.included)
          .map((l) => ({ generatedDocumentId: l.generatedDocumentId, percentCompleted: l.percentCompleted })),
      };
      const url = existing ? `/api/documents/generated/${existing.id}/regenerate` : "/api/documents/generated/progress-claim";
      const body = existing ? payload : { ...payload, projectId };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Failed to generate progress claim");
      }
      return res.json();
    },
    onSuccess: async (data: { document?: { id: string } }) => {
      toast.success(existing ? "Progress claim regenerated" : "Progress claim generated");
      // Auto-adds the new document to the commercial Progress Claims register (Phase 8) — never a separate manual step.
      if (!existing && data?.document?.id) {
        await fetch("/api/finance/progress-claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generatedDocumentId: data.document.id }),
        }).catch(() => undefined);
      }
      queryClient.invalidateQueries({ queryKey: ["generated-documents", { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["finance", "progress-claims", projectId] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canSubmit = contractWorkLines.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? `Regenerate ${existing.number}` : "Generate Progress Claim"}</DialogTitle>
          <DialogDescription>
            Contract values come from this project&apos;s trade packages. Previously claimed amounts are carried
            forward automatically from the prior claim.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium leading-none text-foreground">Contract Work</p>
            {contractWorkLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This project has no trade packages set yet — add them on the project before generating a claim.
              </p>
            ) : (
              contractWorkLines.map((line, i) => (
                <div key={line.name} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{line.name}</span>
                  <span className="w-28 text-right text-xs text-muted-foreground">
                    ${line.contractValue.toLocaleString()}
                  </span>
                  <Input
                    aria-label={`${line.name} percent complete`}
                    type="number"
                    min={0}
                    max={100}
                    className="w-24"
                    value={line.percentCompleted}
                    onChange={(e) =>
                      setContractWorkLines((lines) =>
                        lines.map((l, idx) => (idx === i ? { ...l, percentCompleted: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <span className="text-xs text-muted-foreground">% complete</span>
                </div>
              ))
            )}
          </div>

          {variationLines.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium leading-none text-foreground">Variations</p>
              {variationLines.map((line, i) => (
                <div key={line.generatedDocumentId} className="flex items-center gap-2">
                  <Switch
                    aria-label={`Include ${line.number} in this claim`}
                    checked={line.included}
                    onCheckedChange={(checked) =>
                      setVariationLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, included: checked } : l)))
                    }
                  />
                  <span className="flex-1 text-sm">{line.number}</span>
                  <span className="w-28 text-right text-xs text-muted-foreground">${line.amount.toLocaleString()}</span>
                  <Input
                    aria-label={`${line.number} percent complete`}
                    type="number"
                    min={0}
                    max={100}
                    className="w-24"
                    disabled={!line.included}
                    value={line.percentCompleted}
                    onChange={(e) =>
                      setVariationLines((lines) =>
                        lines.map((l, idx) => (idx === i ? { ...l, percentCompleted: Number(e.target.value) } : l))
                      )
                    }
                  />
                  <span className="text-xs text-muted-foreground">% complete</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Generating..." : existing ? "Regenerate" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
