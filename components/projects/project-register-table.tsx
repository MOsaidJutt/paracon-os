"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColumnVisibilityMenu } from "@/components/ui/column-visibility-menu";
import { useColumnPreferences } from "@/lib/dashboard/use-column-preferences";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import { ProjectFormSheet } from "./project-form-sheet";
import type { ProjectConfig } from "@/lib/projects/config";

type ApiProject = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  status: string;
  value: number;
  startDate: string;
  endDate: string;
  clientId: string;
  pmUserId: string | null;
  client: { id: string; name: string };
  pmUser: { id: string; name: string } | null;
};

const DEFAULT_COLUMNS = [
  { id: "project", title: "Project" },
  { id: "client", title: "Client" },
  { id: "status", title: "Status" },
  { id: "value", title: "Value" },
  { id: "pm", title: "PM" },
  { id: "start", title: "Start" },
  { id: "end", title: "End" },
];
const TITLE_BY_ID = Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.id, c.title]));

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Critical") return "destructive";
  if (status === "Attention") return "secondary";
  return "default";
}

function renderCell(columnId: string, project: ApiProject) {
  switch (columnId) {
    case "project":
      return (
        <>
          <span className="font-medium text-foreground">{project.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">{project.code}</span>
        </>
      );
    case "client":
      return <span className="text-muted-foreground">{project.client.name}</span>;
    case "status":
      return <Badge variant={statusVariant(project.status)}>{project.status}</Badge>;
    case "value":
      return formatCurrency(project.value);
    case "pm":
      return <span className="text-muted-foreground">{project.pmUser?.name ?? "Unassigned"}</span>;
    case "start":
      return formatDate(project.startDate);
    case "end":
      return formatDate(project.endDate);
    default:
      return null;
  }
}

export function ProjectRegisterTable() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { columns, toggleColumn, reorderColumns } = useColumnPreferences("register:projects", DEFAULT_COLUMNS);
  const visibleColumns = columns.filter((c) => c.visible);

  const { data: config } = useQuery({
    queryKey: ["projects", "config"],
    queryFn: async () => {
      const res = await fetch("/api/projects/config");
      if (!res.ok) throw new Error("Failed to load project config");
      return (await res.json()) as ProjectConfig;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["projects", "list", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "__all__") params.set("status", statusFilter);
      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load projects");
      return (await res.json()) as { projects: ApiProject[] };
    },
  });

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
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="size-4" />
            Add project
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
            {data?.projects.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                {visibleColumns.map((c) => (
                  <TableCell key={c.id}>{renderCell(c.id, project)}</TableCell>
                ))}
              </TableRow>
            ))}
            {data && data.projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">
                  No projects found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ProjectFormSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
