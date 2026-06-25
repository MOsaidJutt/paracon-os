"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinanceConfig } from "@/lib/finance/config";

type Supplier = { id: string; company: string };
type PurchaseOrder = { id: string; number: string };

export function DeliveryFormSheet({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [poId, setPoId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [status, setStatus] = useState("Pending");
  const [expectedDate, setExpectedDate] = useState("");
  const [deliveredDate, setDeliveredDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setPoId("");
      setSupplierId("");
      setStatus("Pending");
      setExpectedDate("");
      setDeliveredDate("");
      setDescription("");
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

  const { data: posData } = useQuery({
    queryKey: ["finance", "purchase-orders", projectId],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/purchase-orders`);
      if (!res.ok) throw new Error("Failed to load purchase orders");
      return (await res.json()) as { purchaseOrders: PurchaseOrder[] };
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

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poId: poId || null,
          supplierId: supplierId || null,
          status,
          expectedDate: expectedDate || null,
          deliveredDate: deliveredDate || null,
          itemsJson: description.trim() ? [{ description }] : [],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create delivery");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Delivery recorded");
      queryClient.invalidateQueries({ queryKey: ["finance", "deliveries", projectId] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Record delivery</SheetTitle>
          <SheetDescription>Link to a PO where one exists — small ad-hoc deliveries don&apos;t need one.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-po">Purchase order</Label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger id="delivery-po">
                  <SelectValue placeholder="None" />
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-supplier">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="delivery-supplier">
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
              <Label htmlFor="delivery-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="delivery-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(config?.deliveryStatusList ?? []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-expected">Expected date</Label>
              <Input id="delivery-expected" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-delivered">Delivered date</Label>
              <Input id="delivery-delivered" type="date" value={deliveredDate} onChange={(e) => setDeliveredDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-description">What&apos;s being delivered</Label>
            <Input id="delivery-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Plasterboard sheets, 200 units" />
          </div>
        </div>

        <SheetFooter>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
