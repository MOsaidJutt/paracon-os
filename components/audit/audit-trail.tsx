"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { AuditDiff } from "@/components/shared/audit-diff";

type AuditTrailRow = {
  id: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  user: { name: string; email: string } | null;
};

/**
 * Xero-style "who changed what, when" for a single record — reads the same
 * AuditLog rows already written on every mutation, scoped to one entity.
 * Collapsed by default so it never adds to the page's above-the-fold weight.
 */
export function AuditTrail({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["audit-trail", entityType, entityId],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/audit?entityType=${entityType}&entityId=${entityId}`);
      if (!res.ok) throw new Error("Failed to load activity");
      return (await res.json()) as { logs: AuditTrailRow[] };
    },
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border p-4">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-sm font-medium text-foreground">
        <span className="flex items-center gap-1.5">
          <History className="size-4 text-muted-foreground" /> Activity
        </span>
        {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity...</p>
        ) : isError || !data ? (
          <QueryErrorState message="Failed to load activity." onRetry={() => refetch()} isRetrying={isRefetching} />
        ) : data.logs.length === 0 ? (
          <EmptyState title="No activity yet" description="Changes to this record will appear here." />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {data.logs.map((log) => (
              <li key={log.id} className="py-2 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="flex w-full items-center justify-between gap-3 text-left text-sm"
                >
                  <span className="text-foreground">
                    <span className="font-medium">{log.user?.name ?? "System"}</span>{" "}
                    <span className="text-muted-foreground">{log.action}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                </button>
                {expandedId === log.id && (log.before !== null || log.after !== null) && (
                  <div className="mt-2">
                    <AuditDiff before={log.before} after={log.after} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
