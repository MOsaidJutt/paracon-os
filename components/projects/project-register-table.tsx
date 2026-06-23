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

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Critical") return "destructive";
  if (status === "Attention") return "secondary";
  return "default";
}

export function ProjectRegisterTable() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [sheetOpen, setSheetOpen] = useState(false);

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
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="size-4" />
          Add project
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>PM</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
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
            {data?.projects.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <TableCell className="font-medium text-foreground">
                  {project.name}
                  <span className="ml-2 text-xs text-muted-foreground">{project.code}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{project.client.name}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
                </TableCell>
                <TableCell>{formatCurrency(project.value)}</TableCell>
                <TableCell className="text-muted-foreground">{project.pmUser?.name ?? "Unassigned"}</TableCell>
                <TableCell>{formatDate(project.startDate)}</TableCell>
                <TableCell>{formatDate(project.endDate)}</TableCell>
              </TableRow>
            ))}
            {data && data.projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
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
