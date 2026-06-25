"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/tenders/format";

type VariationRow = {
  id: string;
  number: string;
  value: number;
  status: string;
  generatedDocument: { id: string; pdfFileId: string | null };
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Approved") return "default";
  if (status === "Rejected") return "destructive";
  return "secondary";
}

export function VariationsRegister({ projectId, canApprove }: { projectId: string; canApprove: boolean }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "variations", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/finance/variations?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to load variations");
      return (await res.json()) as { variations: VariationRow[] };
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "outstanding" | "reject" }) => {
      const body = action === "reject" ? { note: "Rejected from the Variations register" } : {};
      const res = await fetch(`/api/finance/variations/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Failed to update variation");
      }
    },
    onSuccess: () => {
      toast.success("Variation updated");
      queryClient.invalidateQueries({ queryKey: ["finance", "variations", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const variations = data?.variations ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Variations</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-md bg-muted/40" />
        ) : variations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variations yet — generate one from the Documents tab.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  {canApprove && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {variations.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium text-foreground">{v.number}</TableCell>
                    <TableCell>{formatCurrency(v.value)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                    </TableCell>
                    {canApprove && (
                      <TableCell className="flex justify-end gap-1.5">
                        {v.status !== "Approved" && (
                          <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: v.id, action: "approve" })}>
                            Approve
                          </Button>
                        )}
                        {v.status !== "Outstanding" && (
                          <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: v.id, action: "outstanding" })}>
                            Outstanding
                          </Button>
                        )}
                        {v.status !== "Rejected" && (
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => decide.mutate({ id: v.id, action: "reject" })}>
                            Reject
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
