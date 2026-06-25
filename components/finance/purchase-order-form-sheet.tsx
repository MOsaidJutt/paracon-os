"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinanceConfig } from "@/lib/finance/config";

type Supplier = { id: string; company: string };
type LineItem = { description: string; quantity: number; unit: string; unitRate: number; amount: number };

export function PurchaseOrderFormSheet({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState<string>("");
  const [status, setStatus] = useState("Draft");
  const [expectedDate, setExpectedDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit: "ea", unitRate: 0, amount: 0 }]);

  useEffect(() => {
    if (open) {
      setSupplierId("");
      setStatus("Draft");
      setExpectedDate("");
      setItems([{ description: "", quantity: 1, unit: "ea", unitRate: 0, amount: 0 }]);
    }
  }, [open]);

  const { data: suppliersData } = useQuery({
    queryKey: ["finance", "suppliers"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/finance/suppliers");
      if (!res.ok) throw new Error("Failed to load suppliers");
      return (await res.json()) as { suppliers: Supplier[] };
    },
  });

  const { data: config } = useQuery({
    queryKey: ["finance", "config"],
    queryFn: async () => {
      const res = await fetch("/api/finance/config");
      if (!res.ok) throw new Error("Failed to load finance config");
      return (await res.json()) as FinanceConfig;
    },
  });

  const value = items.reduce((sum, i) => sum + i.amount, 0);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((rows) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        next.amount = patch.amount != null ? patch.amount : next.quantity * next.unitRate;
        return next;
      })
    );
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId || null,
          status,
          expectedDate: expectedDate || null,
          itemsJson: items.filter((i) => i.description.trim()),
          value,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create purchase order");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Purchase order created");
      queryClient.invalidateQueries({ queryKey: ["finance", "purchase-orders", projectId] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canSubmit = items.some((i) => i.description.trim() && i.amount > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New Purchase Order</SheetTitle>
          <SheetDescription>Auto-numbered per project (PO-01, PO-02, ...).</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-supplier">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="po-supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {(suppliersData?.suppliers ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="po-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(config?.poStatusList ?? []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-expected-date">Expected date</Label>
              <Input id="po-expected-date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium leading-none text-foreground">Items</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems((rows) => [...rows, { description: "", quantity: 1, unit: "ea", unitRate: 0, amount: 0 }])}
              >
                <Plus className="size-4" />
                Add line
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label="Description"
                  placeholder="Description"
                  className="flex-1"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                />
                <Input
                  aria-label="Amount"
                  type="number"
                  placeholder="$"
                  className="w-28"
                  value={item.amount || ""}
                  onChange={(e) => updateItem(i, { amount: Number(e.target.value) })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  disabled={items.length === 1}
                  onClick={() => setItems((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <p className="text-right text-sm text-muted-foreground">Total: ${value.toLocaleString()}</p>
          </div>
        </div>

        <SheetFooter>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating..." : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
