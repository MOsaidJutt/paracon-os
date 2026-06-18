"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, formatPercent } from "@/lib/tenders/format";
import { TenderFormSheet, type TenderRow } from "./tender-form-sheet";
import type { TenderConfig } from "@/lib/tenders/config";

type ApiTender = TenderRow & {
  winProbabilityNumeric: number;
  client: { id: string; name: string };
  contact: { id: string; name: string } | null;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Won") return "default";
  if (status === "Lost" || status === "Withdrawn") return "destructive";
  return "secondary";
}

function isOverdue(due: string | null, submitted: string | null): boolean {
  if (!due || submitted) return false;
  return new Date(due) < new Date();
}

export function TenderRegisterTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<TenderRow | null>(null);

  const { data: config } = useQuery({
    queryKey: ["tenders", "config"],
    queryFn: async () => {
      const res = await fetch("/api/tenders/config");
      if (!res.ok) throw new Error("Failed to load tender config");
      return (await res.json()) as TenderConfig;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["tenders", "list", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "__all__") params.set("status", statusFilter);
      const res = await fetch(`/api/tenders?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load tenders");
      return (await res.json()) as { tenders: ApiTender[] };
    },
  });

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "__all__") params.set("status", statusFilter);
    return `/api/tenders/export?${params.toString()}`;
  }, [search, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search project name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              {config?.statusList.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Download className="size-4" />
              Export
            </a>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingTender(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add tender
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Win Prob</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {data?.tenders.map((tender) => {
              const overdue = isOverdue(tender.due, tender.submitted);
              return (
                <TableRow
                  key={tender.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setEditingTender(tender);
                    setSheetOpen(true);
                  }}
                >
                  <TableCell className="font-medium text-foreground">{tender.projectName}</TableCell>
                  <TableCell className="text-muted-foreground">{tender.client.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(tender.status)}>{tender.status}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(tender.value)}</TableCell>
                  <TableCell>
                    {tender.winProbabilityText} ({formatPercent(tender.winProbabilityNumeric)})
                  </TableCell>
                  <TableCell>
                    <span className={overdue ? "flex items-center gap-1 text-destructive" : ""}>
                      {overdue && <AlertTriangle className="size-3.5" />}
                      {formatDate(tender.due)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tender.outcome ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {data && data.tenders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No tenders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TenderFormSheet open={sheetOpen} onOpenChange={setSheetOpen} tender={editingTender} />
    </div>
  );
}
