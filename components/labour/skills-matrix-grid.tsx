"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComplianceBadge } from "./compliance-badge";
import { WorkerFormSheet } from "./worker-form-sheet";
import type { LabourConfig } from "@/lib/labour/config";

type MatrixSkill = { id: string; name: string };
type MatrixWorker = {
  id: string;
  name: string;
  photoUrl: string | null;
  capability: string;
  status: string;
  complianceStatus: string;
  skillLevels: Record<string, number>;
};

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Available") return "default";
  if (status === "Assigned") return "secondary";
  return "outline";
}

function SkillLevelDots({ level }: { level: number | undefined }) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`size-1.5 rounded-full ${i < level ? "bg-[#B08D57]" : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

export function SkillsMatrixGrid() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [complianceFilter, setComplianceFilter] = useState("__all__");
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["labour", "config"],
    queryFn: async () => {
      const res = await fetch("/api/labour/config");
      if (!res.ok) throw new Error("Failed to load labour config");
      return (await res.json()) as LabourConfig;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["labour", "matrix", capabilityFilter, statusFilter, complianceFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (capabilityFilter !== "__all__") params.set("capability", capabilityFilter);
      if (statusFilter !== "__all__") params.set("status", statusFilter);
      if (complianceFilter !== "__all__") params.set("compliance", complianceFilter);
      const res = await fetch(`/api/labour/matrix?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load skills matrix");
      return (await res.json()) as { skills: MatrixSkill[]; workers: MatrixWorker[] };
    },
  });

  const skills = data?.skills ?? [];
  const workers = (data?.workers ?? []).filter((w) => w.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search worker name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Select value={capabilityFilter} onValueChange={setCapabilityFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All trades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All trades</SelectItem>
              {config?.capabilityList.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All availability</SelectItem>
              {config?.statusList.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={complianceFilter} onValueChange={setComplianceFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All compliance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All compliance</SelectItem>
              <SelectItem value="Valid">Valid</SelectItem>
              <SelectItem value="Expiring">Expiring</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="size-4" />
          Add worker
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead>Capability</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Compliance</TableHead>
              {skills.map((skill) => (
                <TableHead key={skill.id} className="text-center">
                  {skill.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4 + skills.length} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {workers.map((worker) => (
              <TableRow key={worker.id} className="cursor-pointer" onClick={() => router.push(`/labour/${worker.id}`)}>
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarImage src={worker.photoUrl ?? undefined} alt={worker.name} />
                      <AvatarFallback>{worker.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {worker.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{worker.capability}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(worker.status)}>{worker.status}</Badge>
                </TableCell>
                <TableCell>
                  <ComplianceBadge status={worker.complianceStatus} expiryDate={null} />
                </TableCell>
                {skills.map((skill) => (
                  <TableCell key={skill.id} className="text-center">
                    <div className="flex justify-center">
                      <SkillLevelDots level={worker.skillLevels[skill.id]} />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {data && workers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4 + skills.length} className="text-center text-muted-foreground">
                  No workers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <WorkerFormSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
