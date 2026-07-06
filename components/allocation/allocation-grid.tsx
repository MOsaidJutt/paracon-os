"use client";

import { Fragment, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/tenders/format";
import { roundShortfall } from "@/lib/forecast/format";
import { WorkerHoverCard, type HoverWorker } from "./worker-hover-card";
import { AddWorkerDialog } from "./add-worker-dialog";
import { useAllocationMutations } from "./use-allocation-mutations";
import type { PoolWorker } from "./worker-pool";

type AllocationChip = { allocationId: string; workerId: string; name: string; photoUrl: string | null };
type WeekCell = { required: number; workers: AllocationChip[] };
type BlockCell = {
  role: string;
  blockIndex: number;
  blockLabel: string;
  required: number;
  allocated: number;
  status: "Covered" | "Watch" | "Short";
  severity: "normal" | "critical";
};
type AllocationsResponse = {
  projectId: string;
  weeks: string[];
  blocks: { index: number; label: string; weeks: string[] }[];
  roles: string[];
  weekly: Record<string, Record<string, WeekCell>>;
  blockCells: BlockCell[];
};

function BlockBadge({ cell }: { cell: BlockCell }) {
  if (cell.status === "Covered") return <Badge variant="success">{cell.allocated}/{cell.required}</Badge>;
  if (cell.status === "Watch")
    return (
      <Badge variant="warning">
        {cell.allocated}/{cell.required} · short {roundShortfall(cell.required - cell.allocated)}
      </Badge>
    );
  return (
    <Badge variant="destructive" className={cn(cell.severity === "critical" && "ring-2 ring-destructive/40")}>
      {cell.allocated}/{cell.required} · short {roundShortfall(cell.required - cell.allocated)}
    </Badge>
  );
}

function WeekDropCell({
  role,
  week,
  cell,
  workersById,
  projectName,
  onRemove,
  onAdd,
}: {
  role: string;
  week: string;
  cell: WeekCell;
  workersById: Map<string, PoolWorker>;
  projectName: string;
  onRemove: (allocationId: string) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `cell:${role}:${week}` });
  const draggingWorker = active?.data.current?.worker as PoolWorker | undefined;
  const isValidTarget = !draggingWorker || draggingWorker.capability === role;

  return (
    <TableCell
      ref={setNodeRef}
      className={cn(
        "min-w-[140px] align-top",
        isOver && isValidTarget && "bg-rag-green/10 ring-1 ring-rag-green",
        isOver && !isValidTarget && "bg-destructive/10 ring-1 ring-destructive"
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Req {cell.required}</span>
          <Button variant="ghost" size="icon" className="size-5" onClick={onAdd} aria-label={`Add ${role} for week of ${week}`}>
            <Plus className="size-3.5" />
          </Button>
        </div>
        {cell.workers.map((chip) => {
          const fullWorker = workersById.get(chip.workerId);
          const hoverWorker: HoverWorker = fullWorker
            ? { ...fullWorker, currentSite: projectName }
            : { id: chip.workerId, name: chip.name, photoUrl: chip.photoUrl, capability: role, status: "Assigned", baseLocation: null, compliance: [], skills: [], currentSite: projectName };
          return (
            <WorkerHoverCard key={chip.allocationId} worker={hoverWorker}>
              <div className="group flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 text-xs">
                <Avatar className="size-5">
                  <AvatarImage src={chip.photoUrl ?? undefined} alt={chip.name} />
                  <AvatarFallback className="text-[9px]">{chip.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-foreground">{chip.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(chip.allocationId)}
                  className="opacity-0 group-hover:opacity-100"
                  aria-label={`Remove ${chip.name}`}
                >
                  <X className="size-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </WorkerHoverCard>
          );
        })}
      </div>
    </TableCell>
  );
}

export function AllocationGrid({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [picker, setPicker] = useState<{ role: string; week: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["allocations", "project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/allocations`);
      if (!res.ok) throw new Error("Failed to load the allocation grid");
      return (await res.json()) as AllocationsResponse;
    },
  });

  const { data: poolData } = useQuery({
    queryKey: ["allocations", "workers"],
    queryFn: async () => {
      const res = await fetch("/api/allocations/workers");
      if (!res.ok) throw new Error("Failed to load worker pool");
      return (await res.json()) as { workers: PoolWorker[] };
    },
  });
  const workersById = new Map((poolData?.workers ?? []).map((w) => [w.id, w]));

  const { addMutation, removeMutation } = useAllocationMutations(projectId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the allocation grid...</p>;
  if (isError) {
    return <QueryErrorState message="Failed to load the allocation grid." onRetry={() => refetch()} />;
  }
  if (!data || data.roles.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No labour requirement set for this project yet — add program activities with crew counts first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2}>Trade</TableHead>
              {data.blocks.map((block) => (
                <TableHead key={block.index} colSpan={block.weeks.length} className="text-center">
                  {block.label}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              {data.weeks.map((week) => (
                <TableHead key={week} className="text-center text-[11px] font-normal text-muted-foreground">
                  {formatDate(week)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.roles.map((role) => (
              <Fragment key={role}>
                <TableRow className="border-b-0">
                  <TableHead rowSpan={2} className="align-top font-medium text-foreground">
                    {role}
                  </TableHead>
                  {data.blocks.map((block) => {
                    const cell = data.blockCells.find((c) => c.role === role && c.blockIndex === block.index);
                    return (
                      <TableCell key={block.index} colSpan={block.weeks.length} className="bg-muted/30 text-center">
                        {cell && <BlockBadge cell={cell} />}
                      </TableCell>
                    );
                  })}
                </TableRow>
                <TableRow>
                  {data.weeks.map((week) => (
                    <WeekDropCell
                      key={week}
                      role={role}
                      week={week}
                      cell={data.weekly[week]?.[role] ?? { required: 0, workers: [] }}
                      workersById={workersById}
                      projectName={projectName}
                      onRemove={(allocationId) => removeMutation.mutate(allocationId)}
                      onAdd={() => setPicker({ role, week })}
                    />
                  ))}
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {picker && (
        <AddWorkerDialog
          open
          onOpenChange={(open) => !open && setPicker(null)}
          role={picker.role}
          week={picker.week}
          onPick={(workerId) => {
            addMutation.mutate({ workerId, weekStart: picker.week, role: picker.role });
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

export type { AllocationsResponse, WeekCell, BlockCell };
