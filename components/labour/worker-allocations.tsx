"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/tenders/format";

type AllocationRow = {
  id: string;
  weekStart: string;
  project: { id: string; name: string; code: string };
};

/** Current + next allocations from Phase 9's Resource Planner — the data this tab was waiting on. */
export function WorkerAllocations({ workerId }: { workerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["workers", workerId, "allocations"],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${workerId}/allocations`);
      if (!res.ok) throw new Error("Failed to load allocations");
      return (await res.json()) as { allocations: AllocationRow[] };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading allocations...</p>;

  const allocations = data?.allocations ?? [];
  if (allocations.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Not currently allocated to any project.
      </div>
    );
  }

  const [current, ...upcoming] = allocations;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-xs text-muted-foreground">Current site (week of {formatDate(current.weekStart)})</p>
            <Link href={`/projects/${current.project.id}`} className="font-medium text-foreground hover:underline">
              {current.project.code} — {current.project.name}
            </Link>
          </div>
          <Badge variant="default">On site</Badge>
        </CardContent>
      </Card>

      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Upcoming</p>
          <div className="flex flex-col gap-2">
            {upcoming.map((allocation) => (
              <div key={allocation.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{formatDate(allocation.weekStart)}</span>
                <Link href={`/projects/${allocation.project.id}`} className="font-medium text-foreground hover:underline">
                  {allocation.project.code} — {allocation.project.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
