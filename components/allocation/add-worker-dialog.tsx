"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/tenders/format";
import type { PoolWorker } from "./worker-pool";

/**
 * Click-to-add fallback for a grid cell — the same eligibility rules the
 * drag-and-drop path enforces server-side (compliance-expired / already
 * booked that week), surfaced up front instead of failing after a drop.
 * Exists for keyboard/non-drag accessibility and gives e2e a reliable target.
 */
export function AddWorkerDialog({
  open,
  onOpenChange,
  role,
  week,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  week: string;
  onPick: (workerId: string) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["allocations", "workers"],
    queryFn: async () => {
      const res = await fetch("/api/allocations/workers");
      if (!res.ok) throw new Error("Failed to load worker pool");
      return (await res.json()) as { workers: PoolWorker[] };
    },
  });

  const candidates = (data?.workers ?? []).filter((w) => w.capability === role);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={`Add a ${role} for week of ${formatDate(week)}...`} />
      <CommandList>
        {isLoading && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading workers...</p>}
        {isError && <p className="px-2 py-6 text-center text-sm text-destructive">Failed to load workers — close and try again.</p>}
        {!isLoading && !isError && <CommandEmpty>No {role} workers found.</CommandEmpty>}
        {candidates.map((worker) => {
          const busy = worker.busyWeeks[week];
          const blocked = worker.isComplianceExpired || Boolean(busy);
          return (
            <CommandItem
              key={worker.id}
              value={worker.name}
              disabled={blocked}
              onSelect={() => !blocked && onPick(worker.id)}
              className="gap-2"
            >
              <Avatar className="size-6">
                <AvatarImage src={worker.photoUrl ?? undefined} alt={worker.name} />
                <AvatarFallback className="text-[10px]">{worker.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="flex-1">{worker.name}</span>
              {worker.isComplianceExpired && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <Lock className="size-3" /> Compliance expired
                </span>
              )}
              {!worker.isComplianceExpired && busy && (
                <span className="text-xs text-muted-foreground">Booked on {busy.projectName}</span>
              )}
              {!worker.isComplianceExpired && !busy && worker.status !== "Available" && (
                <span className="text-xs text-muted-foreground">{worker.status}</span>
              )}
            </CommandItem>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
