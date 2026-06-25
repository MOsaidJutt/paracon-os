"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import { PurchaseOrderFormSheet } from "./purchase-order-form-sheet";

type PurchaseOrderRow = {
  id: string;
  number: string;
  value: number;
  status: string;
  expectedDate: string | null;
  supplier: { id: string; company: string } | null;
  reconcile: { totalBilled: number; variance: number; variancePct: number; overBudget: boolean };
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Cancelled") return "destructive";
  if (status === "Delivered") return "default";
  return "secondary";
}

export function PurchaseOrderRegister({ projectId }: { projectId: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "purchase-orders", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/purchase-orders`);
      if (!res.ok) throw new Error("Failed to load purchase orders");
      return (await res.json()) as { purchaseOrders: PurchaseOrderRow[] };
    },
  });

  const purchaseOrders = data?.purchaseOrders ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Purchase Orders</CardTitle>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="size-4" />
          New PO
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-md bg-muted/40" />
        ) : purchaseOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Billed</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium text-foreground">{po.number}</TableCell>
                    <TableCell className="text-muted-foreground">{po.supplier?.company ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(po.value)}</TableCell>
                    <TableCell>
                      <span className={po.reconcile.overBudget ? "font-medium text-destructive" : "text-muted-foreground"}>
                        {formatCurrency(po.reconcile.totalBilled)}
                      </span>
                      {po.reconcile.overBudget && (
                        <Badge variant="destructive" className="ml-2">
                          Over budget
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(po.expectedDate)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(po.status)}>{po.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <PurchaseOrderFormSheet open={sheetOpen} onOpenChange={setSheetOpen} projectId={projectId} />
    </Card>
  );
}
