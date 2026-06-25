"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/tenders/format";
import type { SupplierBillRow } from "./types";

type PurchaseOrder = { id: string; number: string; value: number };

const CHECKLIST_ITEMS: { key: "orderedConfirmed" | "receivedConfirmed" | "quantityConfirmed" | "priceConfirmed"; label: string }[] = [
  { key: "orderedConfirmed", label: "Ordered? (PO match)" },
  { key: "receivedConfirmed", label: "Received? (delivery match)" },
  { key: "quantityConfirmed", label: "Right quantity?" },
  { key: "priceConfirmed", label: "Right price?" },
];

export function BillReviewSheet({
  bill,
  open,
  onOpenChange,
}: {
  bill: SupplierBillRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [checklist, setChecklist] = useState({
    orderedConfirmed: false,
    receivedConfirmed: false,
    quantityConfirmed: false,
    priceConfirmed: false,
  });
  const [reviewNote, setReviewNote] = useState("");
  const [poId, setPoId] = useState<string>("");
  const [queryNote, setQueryNote] = useState("");

  useEffect(() => {
    if (bill) {
      setChecklist({
        orderedConfirmed: bill.orderedConfirmed,
        receivedConfirmed: bill.receivedConfirmed,
        quantityConfirmed: bill.quantityConfirmed,
        priceConfirmed: bill.priceConfirmed,
      });
      setReviewNote(bill.reviewNote ?? "");
      setPoId(bill.po?.id ?? "");
      setQueryNote("");
    }
  }, [bill]);

  const { data: posData } = useQuery({
    queryKey: ["finance", "purchase-orders", bill?.project?.id],
    enabled: open && !!bill?.project,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${bill!.project!.id}/purchase-orders`);
      if (!res.ok) throw new Error("Failed to load purchase orders");
      return (await res.json()) as { purchaseOrders: PurchaseOrder[] };
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["finance", "bills"] });
  }

  async function persistChecklist() {
    const res = await fetch(`/api/finance/bills/${bill!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...checklist, reviewNote, poId: poId || null }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to save checklist");
    }
  }

  const saveChecklist = useMutation({
    mutationFn: persistChecklist,
    onSuccess: () => {
      toast.success("Checklist saved");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Approve/Query/Reject always save whatever's ticked in the checklist first — the server's
  // approval gate checks the persisted checklist, not whatever's unsaved in this form's state.
  const decide = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: unknown }) => {
      await persistChecklist();
      const res = await fetch(`/api/finance/bills/${bill!.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Action failed");
      }
    },
    onSuccess: () => {
      toast.success("Bill updated");
      invalidate();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!bill) return null;

  const allConfirmed = Object.values(checklist).every(Boolean);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {bill.supplier?.company ?? bill.supplierNameRaw ?? "Unknown supplier"}
            <Badge variant="secondary">{bill.status}</Badge>
          </SheetTitle>
          <SheetDescription>
            {bill.invoiceNumber ? `Invoice ${bill.invoiceNumber}` : "No invoice number"} · {formatCurrency(bill.amountIncGst)} inc GST
            {bill.jobNumberRaw ? ` · job number found: ${bill.jobNumberRaw}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 px-4 py-4">
          {bill.project && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bill-review-po">Purchase order</Label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger id="bill-review-po">
                  <SelectValue placeholder="No PO matched" />
                </SelectTrigger>
                <SelectContent>
                  {(posData?.purchaseOrders ?? []).map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.number} · {formatCurrency(po.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium leading-none text-foreground">Review checklist</p>
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label htmlFor={`check-${item.key}`} className="text-sm font-normal">
                  {item.label}
                </Label>
                <Switch
                  id={`check-${item.key}`}
                  checked={checklist[item.key]}
                  onCheckedChange={(checked) => setChecklist((c) => ({ ...c, [item.key]: checked }))}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-review-note">Note</Label>
            <Textarea id="bill-review-note" rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
          </div>

          <Button variant="outline" size="sm" disabled={saveChecklist.isPending} onClick={() => saveChecklist.mutate()}>
            {saveChecklist.isPending ? "Saving..." : "Save checklist"}
          </Button>

          {(bill.status === "Received" || bill.status === "Under review") && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button disabled={!allConfirmed || decide.isPending} onClick={() => decide.mutate({ path: "approve" })}>
                Approve
              </Button>
              {!allConfirmed && <p className="text-xs text-muted-foreground">All four checklist items must be confirmed to approve.</p>}
              <Textarea
                placeholder="Note for query/reject..."
                rows={2}
                value={queryNote}
                onChange={(e) => setQueryNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!queryNote.trim() || decide.isPending}
                  onClick={() => decide.mutate({ path: "query", body: { note: queryNote } })}
                >
                  Query
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive"
                  disabled={!queryNote.trim() || decide.isPending}
                  onClick={() => decide.mutate({ path: "reject", body: { note: queryNote } })}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}

          {bill.status === "Queried" && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button disabled={!allConfirmed || decide.isPending} onClick={() => decide.mutate({ path: "approve" })}>
                Approve
              </Button>
            </div>
          )}

          {bill.status === "Approved" && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ path: "mark-sent" })}>
                Mark sent to EzzyBills
              </Button>
            </div>
          )}

          {(bill.status === "Sent to EzzyBills" || bill.status === "Approved") && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ path: "mark-paid" })}>
                Mark paid
              </Button>
            </div>
          )}

          {bill.status === "Paid" && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ path: "mark-reconciled" })}>
                Mark reconciled
              </Button>
            </div>
          )}
        </div>

        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}
