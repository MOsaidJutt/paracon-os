"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BillsTable } from "./bills-table";
import { BillReviewSheet } from "./bill-review-sheet";
import { AllocateBillDialog } from "./allocate-bill-dialog";
import { CreateBillDialog } from "./create-bill-dialog";
import type { SupplierBillRow } from "./types";
import type { FinanceConfig } from "@/lib/finance/config";

export function FinanceHub({ canEdit }: { canEdit: boolean }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [reviewBill, setReviewBill] = useState<SupplierBillRow | null>(null);
  const [allocateBill, setAllocateBill] = useState<SupplierBillRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["finance", "config"],
    queryFn: async () => {
      const res = await fetch("/api/finance/config");
      if (!res.ok) throw new Error("Failed to load finance config");
      return (await res.json()) as FinanceConfig;
    },
  });
  const statusFilters = ["All", ...(config?.billStatusList ?? [])];

  const { data: unallocatedData } = useQuery({
    queryKey: ["finance", "bills", { allocationStatus: "Unallocated" }],
    queryFn: async () => {
      const res = await fetch("/api/finance/bills?allocationStatus=Unallocated");
      if (!res.ok) throw new Error("Failed to load unallocated bills");
      return (await res.json()) as { bills: SupplierBillRow[] };
    },
  });

  const { data: inboxData, isLoading } = useQuery({
    queryKey: ["finance", "bills", { status: statusFilter }],
    queryFn: async () => {
      const url = statusFilter === "All" ? "/api/finance/bills" : `/api/finance/bills?status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load bills");
      return (await res.json()) as { bills: SupplierBillRow[] };
    },
  });

  const unallocated = unallocatedData?.bills ?? [];
  const inbox = inboxData?.bills ?? [];

  function handleRowClick(bill: SupplierBillRow) {
    if (bill.allocationStatus === "Unallocated") setAllocateBill(bill);
    else setReviewBill(bill);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Incoming supplier bills, the review/approval workflow, and exports for the accounts team.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add bill
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href="/api/finance/export/xero">
              <Download className="size-4" />
              Xero export
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href="/api/finance/export/accountant">
              <Download className="size-4" />
              Accountant export
            </a>
          </Button>
        </div>
      </div>

      {unallocated.length > 0 && (
        <Card className="border-rag-amber/40">
          <CardHeader>
            <CardTitle className="text-base">Unallocated tray</CardTitle>
            <CardDescription>
              The mailbox watcher couldn&apos;t confidently match these to a project — assign one in one click.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BillsTable bills={unallocated} showProject={false} onRowClick={(b) => setAllocateBill(b)} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Bills inbox</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" aria-label="Bills inbox status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-16 animate-pulse rounded-md bg-muted/40" /> : <BillsTable bills={inbox} onRowClick={handleRowClick} />}
        </CardContent>
      </Card>

      <BillReviewSheet bill={reviewBill} open={!!reviewBill} onOpenChange={(open) => !open && setReviewBill(null)} />
      <AllocateBillDialog bill={allocateBill} open={!!allocateBill} onOpenChange={(open) => !open && setAllocateBill(null)} />
      <CreateBillDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
