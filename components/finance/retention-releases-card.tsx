"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import type { FinanceConfig } from "@/lib/finance/config";

type RetentionRelease = { id: string; amount: number; type: string; releasedAt: string; note: string | null };

/** "PracticalCompletion" -> "Practical Completion" — the type list is config-driven PascalCase codes, this just makes them readable. */
function humanizeReleaseType(type: string) {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function RetentionReleasesCard({ projectId, canApprove }: { projectId: string; canApprove: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("PracticalCompletion");

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "retention-releases", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/finance/retention-releases?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to load retention releases");
      return (await res.json()) as { releases: RetentionRelease[] };
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

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finance/retention-releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, amount: Number(amount), type }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to record retention release");
      }
    },
    onSuccess: () => {
      toast.success("Retention release recorded");
      queryClient.invalidateQueries({ queryKey: ["finance", "retention-releases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["finance", "financials", projectId] });
      setOpen(false);
      setAmount("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const releases = data?.releases ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Retention releases</CardTitle>
        {canApprove && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Record release
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-12 animate-pulse rounded-md bg-muted/40" />
        ) : releases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No retention released yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{formatDate(r.releasedAt)}</TableCell>
                  <TableCell>{humanizeReleaseType(r.type)}</TableCell>
                  <TableCell>{formatCurrency(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record retention release</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="retention-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="retention-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(config?.retentionReleaseTypeList ?? []).map((t) => (
                    <SelectItem key={t} value={t}>
                      {humanizeReleaseType(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="retention-amount">Amount</Label>
              <Input id="retention-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!amount || create.isPending} onClick={() => create.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
