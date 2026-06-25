"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/tenders/format";
import { DeliveryFormSheet } from "./delivery-form-sheet";

type DeliveryRow = {
  id: string;
  status: string;
  expectedDate: string | null;
  deliveredDate: string | null;
  itemsJson: { description: string }[];
  supplier: { id: string; company: string } | null;
  po: { id: string; number: string } | null;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Delayed") return "destructive";
  if (status === "Delivered") return "default";
  return "secondary";
}

export function DeliveryRegister({ projectId }: { projectId: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "deliveries", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/deliveries`);
      if (!res.ok) throw new Error("Failed to load deliveries");
      return (await res.json()) as { deliveries: DeliveryRow[] };
    },
  });

  const deliveries = data?.deliveries ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Deliveries</CardTitle>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="size-4" />
          Record delivery
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-md bg-muted/40" />
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Items</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-foreground">{d.itemsJson.map((i) => i.description).join(", ") || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.supplier?.company ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.po?.number ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(d.expectedDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(d.deliveredDate)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <DeliveryFormSheet open={sheetOpen} onOpenChange={setSheetOpen} projectId={projectId} />
    </Card>
  );
}
