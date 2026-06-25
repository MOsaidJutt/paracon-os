"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WorkerHoverCard, type HoverWorker } from "./worker-hover-card";

export type PoolWorker = HoverWorker & {
  isComplianceExpired: boolean;
  busyWeeks: Record<string, { projectId: string; projectName: string }>;
};

function DraggableWorkerChip({ worker }: { worker: PoolWorker }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `worker:${worker.id}`,
    data: { worker },
    disabled: worker.isComplianceExpired,
  });
  const isUnavailable = !worker.isComplianceExpired && worker.status !== "Available";

  return (
    <WorkerHoverCard worker={worker}>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={cn(
          "flex touch-none select-none items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm",
          worker.isComplianceExpired
            ? "cursor-not-allowed opacity-50"
            : "cursor-grab active:cursor-grabbing hover:border-foreground/30",
          isDragging && "opacity-40"
        )}
      >
        <Avatar className="size-6">
          <AvatarImage src={worker.photoUrl ?? undefined} alt={worker.name} />
          <AvatarFallback className="text-[10px]">{worker.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-foreground">{worker.name}</span>
        {worker.isComplianceExpired && <Lock className="size-3.5 shrink-0 text-destructive" />}
        {isUnavailable && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {worker.status}
          </Badge>
        )}
      </div>
    </WorkerHoverCard>
  );
}

export function WorkerPool({ tradeOptions }: { tradeOptions: string[] }) {
  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("__all__");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["allocations", "workers"],
    queryFn: async () => {
      const res = await fetch("/api/allocations/workers");
      if (!res.ok) throw new Error("Failed to load worker pool");
      return (await res.json()) as { workers: PoolWorker[] };
    },
  });

  const workers = (data?.workers ?? []).filter(
    (w) => w.name.toLowerCase().includes(search.toLowerCase()) && (trade === "__all__" || w.capability === trade)
  );

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium text-foreground">Worker pool</p>
        <p className="text-xs text-muted-foreground">Drag onto a week to allocate.</p>
      </div>
      <Input placeholder="Search workers..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
      <Select value={trade} onValueChange={setTrade}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder="All trades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All trades</SelectItem>
          {tradeOptions.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 440 }}>
        {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {isError && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-xs text-destructive">Failed to load the worker pool.</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!isLoading && !isError && workers.length === 0 && <p className="text-xs text-muted-foreground">No workers found.</p>}
        {workers.map((worker) => (
          <DraggableWorkerChip key={worker.id} worker={worker} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        <Lock className="mr-1 inline size-3" />
        Expired compliance — can&apos;t be allocated until renewed.
      </p>
    </div>
  );
}
