"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { useColumnPreferences } from "@/lib/dashboard/use-column-preferences";
import { formatCurrency, formatDate, formatPercent } from "@/lib/tenders/format";
import { TenderFormSheet, type TenderRow } from "./tender-form-sheet";
import type { TenderConfig } from "@/lib/tenders/config";

type ApiTender = TenderRow & {
  winProbabilityNumeric: number;
  client: { id: string; name: string };
  contact: { id: string; name: string } | null;
  project: { id: string; code: string } | null;
};

const DEFAULT_COLUMNS = [
  { id: "project", title: "Project" },
  { id: "client", title: "Client" },
  { id: "status", title: "Status" },
  { id: "value", title: "Value" },
  { id: "winProb", title: "Win Prob" },
  { id: "due", title: "Due" },
  { id: "outcome", title: "Outcome" },
];
const TITLE_BY_ID = Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.id, c.title]));

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Won") return "default";
  if (status === "Lost" || status === "Withdrawn") return "destructive";
  return "secondary";
}

function isOverdue(due: string | null, submitted: string | null): boolean {
  if (!due || submitted) return false;
  return new Date(due) < new Date();
}

function renderCell(columnId: string, tender: ApiTender, overdue: boolean) {
  switch (columnId) {
    case "project":
      return <span className="font-medium text-foreground">{tender.projectName}</span>;
    case "client":
      return <span className="text-muted-foreground">{tender.client.name}</span>;
    case "status":
      return <Badge variant={statusVariant(tender.status)}>{tender.status}</Badge>;
    case "value":
      return formatCurrency(tender.value);
    case "winProb":
      return `${tender.winProbabilityText} (${formatPercent(tender.winProbabilityNumeric)})`;
    case "due":
      return (
        <span className={overdue ? "flex items-center gap-1 text-destructive" : ""}>
          {overdue && <AlertTriangle className="size-3.5" />}
          {formatDate(tender.due)}
        </span>
      );
    case "outcome":
      return <span className="text-muted-foreground">{tender.outcome ?? "—"}</span>;
    default:
      return null;
  }
}

export function TenderRegisterTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<TenderRow | null>(null);
  const { columns, toggleColumn, reorderColumns } = useColumnPreferences("register:tenders", DEFAULT_COLUMNS);
  const visibleColumns = columns.filter((c) => c.visible);

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
          <ColumnVisibilityMenu titleById={TITLE_BY_ID} columns={columns} onToggle={toggleColumn} onReorder={reorderColumns} />
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
              {visibleColumns.map((c) => (
                <TableHead key={c.id}>{TITLE_BY_ID[c.id]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">
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
                  {visibleColumns.map((c) => (
                    <TableCell key={c.id}>{renderCell(c.id, tender, overdue)}</TableCell>
                  ))}
                </TableRow>
              );
            })}
            {data && data.tenders.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">
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
