"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialsSummaryCards } from "./financials-summary-cards";
import { CostBudgetCard } from "./cost-budget-card";
import { PurchaseOrderRegister } from "./purchase-order-register";
import { VariationsRegister } from "./variations-register";
import { ProgressClaimsRegister } from "./progress-claims-register";
import { RetentionReleasesCard } from "./retention-releases-card";
import { BillsTable } from "./bills-table";
import { BillReviewSheet } from "./bill-review-sheet";
import type { SupplierBillRow } from "./types";

export function FinancialsTab({ projectId, canApprove }: { projectId: string; canApprove: boolean }) {
  const [reviewBill, setReviewBill] = useState<SupplierBillRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "bills", { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/finance/bills?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to load bills");
      return (await res.json()) as { bills: SupplierBillRow[] };
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <FinancialsSummaryCards projectId={projectId} />
      <CostBudgetCard projectId={projectId} />
      <PurchaseOrderRegister projectId={projectId} />
      <VariationsRegister projectId={projectId} canApprove={canApprove} />
      <ProgressClaimsRegister projectId={projectId} canApprove={canApprove} />
      <RetentionReleasesCard projectId={projectId} canApprove={canApprove} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bills for this project</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-16 animate-pulse rounded-md bg-muted/40" /> : <BillsTable bills={data?.bills ?? []} showProject={false} onRowClick={setReviewBill} />}
        </CardContent>
      </Card>

      <BillReviewSheet bill={reviewBill} open={!!reviewBill} onOpenChange={(open) => !open && setReviewBill(null)} />
    </div>
  );
}
