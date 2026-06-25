"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import type { SupplierBillRow } from "./types";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Rejected" || status === "Queried") return "destructive";
  if (status === "Paid" || status === "Reconciled") return "default";
  return "secondary";
}

export function BillsTable({
  bills,
  showProject = true,
  onRowClick,
}: {
  bills: SupplierBillRow[];
  showProject?: boolean;
  onRowClick: (bill: SupplierBillRow) => void;
}) {
  if (bills.length === 0) {
    return <p className="text-sm text-muted-foreground">No bills here.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead>Invoice</TableHead>
            {showProject && <TableHead>Project</TableHead>}
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((b) => (
            <TableRow key={b.id} className="cursor-pointer" onClick={() => onRowClick(b)}>
              <TableCell className="font-medium text-foreground">{b.supplier?.company ?? b.supplierNameRaw ?? "Unknown"}</TableCell>
              <TableCell className="text-muted-foreground">
                {b.invoiceNumber ?? "—"} {b.invoiceDate ? `· ${formatDate(b.invoiceDate)}` : ""}
              </TableCell>
              {showProject && (
                <TableCell className="text-muted-foreground">
                  {b.project ? `${b.project.code} ${b.project.name}` : <Badge variant="outline">Unallocated</Badge>}
                </TableCell>
              )}
              <TableCell>{formatCurrency(b.amountIncGst)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
