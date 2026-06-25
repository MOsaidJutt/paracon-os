"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupplierBillRow } from "./types";

type Project = { id: string; name: string; code: string };
type PurchaseOrder = { id: string; number: string };

export function AllocateBillDialog({
  bill,
  open,
  onOpenChange,
}: {
  bill: SupplierBillRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [poId, setPoId] = useState("");

  useEffect(() => {
    if (open) {
      setProjectId("");
      setPoId("");
    }
  }, [open]);

  const { data: projectsData } = useQuery({
    queryKey: ["projects", "all"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return (await res.json()) as { projects: Project[] };
    },
  });

  const { data: posData } = useQuery({
    queryKey: ["finance", "purchase-orders", projectId],
    enabled: open && !!projectId,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/purchase-orders`);
      if (!res.ok) throw new Error("Failed to load purchase orders");
      return (await res.json()) as { purchaseOrders: PurchaseOrder[] };
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/finance/bills/${bill!.id}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, poId: poId || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to allocate bill");
      }
    },
    onSuccess: () => {
      toast.success("Bill allocated");
      queryClient.invalidateQueries({ queryKey: ["finance", "bills"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allocate bill</DialogTitle>
          <DialogDescription>
            {bill.supplier?.company ?? bill.supplierNameRaw ?? "Unknown supplier"} — assign this bill to a project (and optionally a PO) in one click.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="allocate-bill-project">Project</Label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setPoId(""); }}>
              <SelectTrigger id="allocate-bill-project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(projectsData?.projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {projectId && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="allocate-bill-po">Purchase order (optional)</Label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger id="allocate-bill-po">
                  <SelectValue placeholder="No PO" />
                </SelectTrigger>
                <SelectContent>
                  {(posData?.purchaseOrders ?? []).map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button disabled={!projectId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Allocating..." : "Allocate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
