"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Columns3, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/tenders/format";
import { cn } from "@/lib/utils";

export type TaskTreeActivity = {
  id: string;
  parentId: string | null;
  name: string;
  trade: string;
  startDate: string;
  endDate: string;
  status: string;
  isCritical: boolean;
  floatDays: number | null;
};

export type ScheduleColumn = { key: string; visible: boolean };

const COLUMN_LABELS: Record<string, string> = {
  trade: "Trade",
  status: "Status",
  startDate: "Start",
  endDate: "End",
  duration: "Duration",
  critical: "Critical",
};

export const DEFAULT_SCHEDULE_COLUMNS: ScheduleColumn[] = [
  { key: "trade", visible: true },
  { key: "status", visible: true },
  { key: "startDate", visible: true },
  { key: "endDate", visible: true },
  { key: "duration", visible: true },
  { key: "critical", visible: true },
];

function durationDays(startDate: string, endDate: string): number {
  return Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1;
}

type TreeNode = TaskTreeActivity & { depth: number; children: TreeNode[] };

function buildTree(activities: TaskTreeActivity[]): TreeNode[] {
  const byParent = new Map<string | null, TaskTreeActivity[]>();
  for (const a of activities) {
    const list = byParent.get(a.parentId) ?? [];
    list.push(a);
    byParent.set(a.parentId, list);
  }

  function attach(parentId: string | null, depth: number): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((a) => ({ ...a, depth, children: attach(a.id, depth + 1) }));
  }

  return attach(null, 0);
}

function flatten(nodes: TreeNode[], expanded: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0 && expanded.has(node.id)) {
      result.push(...flatten(node.children, expanded));
    }
  }
  return result;
}

export function TaskTreeTable({
  activities,
  columns,
  onColumnsChange,
  onRowClick,
  criticalOnly = false,
}: {
  activities: TaskTreeActivity[];
  columns: ScheduleColumn[];
  onColumnsChange: (columns: ScheduleColumn[]) => void;
  onRowClick: (activity: TaskTreeActivity) => void;
  criticalOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activities.map((a) => a.id)));
  const [dragKey, setDragKey] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(activities), [activities]);
  const rows = useMemo(() => flatten(tree, expanded), [tree, expanded]);
  const visibleRows = criticalOnly ? rows.filter((r) => r.isCritical) : rows;

  const visibleColumns = columns.filter((c) => c.visible);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleColumnVisible(key: string) {
    onColumnsChange(columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }

  function reorderColumn(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    const next = [...columns];
    const fromIndex = next.findIndex((c) => c.key === fromKey);
    const toIndex = next.findIndex((c) => c.key === toKey);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onColumnsChange(next);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{visibleRows.length} task{visibleRows.length === 1 ? "" : "s"}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="size-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            <DropdownMenuLabel className="px-0 text-xs uppercase tracking-wide text-muted-foreground">
              Drag to reorder
            </DropdownMenuLabel>
            <div className="mt-1 flex flex-col gap-1">
              {columns.map((c) => (
                <div
                  key={c.key}
                  draggable
                  onDragStart={() => setDragKey(c.key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragKey) reorderColumn(dragKey, c.key);
                    setDragKey(null);
                  }}
                  className="flex cursor-grab items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/50"
                >
                  <span className="flex items-center gap-1.5 text-sm text-foreground">
                    <GripVertical className="size-3.5 text-muted-foreground" />
                    {COLUMN_LABELS[c.key] ?? c.key}
                  </span>
                  <Switch checked={c.visible} onCheckedChange={() => toggleColumnVisible(c.key)} />
                </div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            {visibleColumns.map((c) => (
              <TableHead key={c.key}>{COLUMN_LABELS[c.key] ?? c.key}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" onClick={() => onRowClick(row)}>
              <TableCell className="font-medium text-foreground">
                <div className="flex items-center gap-1" style={{ paddingLeft: row.depth * 16 }}>
                  {row.children.length > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(row.id);
                      }}
                      className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
                    >
                      {expanded.has(row.id) ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                  ) : (
                    <span className="size-5 shrink-0" />
                  )}
                  <span className={cn(row.isCritical && "text-rag-red")}>
                    {row.name}
                    {row.isCritical && " ★"}
                  </span>
                </div>
              </TableCell>
              {visibleColumns.map((c) => (
                <TableCell key={c.key} className="text-muted-foreground">
                  {renderCell(row, c.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {visibleRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={1 + visibleColumns.length} className="text-center text-muted-foreground">
                No program activities yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function renderCell(row: TaskTreeActivity, key: string) {
  switch (key) {
    case "trade":
      return row.trade;
    case "status":
      return row.status;
    case "startDate":
      return formatDate(row.startDate);
    case "endDate":
      return formatDate(row.endDate);
    case "duration":
      return `${durationDays(row.startDate, row.endDate)}d`;
    case "critical":
      return row.isCritical ? (
        <Badge variant="destructive">Critical</Badge>
      ) : row.floatDays !== null ? (
        `${row.floatDays}d float`
      ) : (
        "—"
      );
    default:
      return null;
  }
}
