"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, Users } from "lucide-react";
import { formatDate } from "@/lib/tenders/format";

type CrossProjectImpactEntry = {
  workerId: string;
  workerName: string;
  otherProjectId: string;
  otherProjectName: string;
  conflictWeeks: string[];
};

type DelayRecordRow = {
  id: string;
  previousStartDate: string;
  previousEndDate: string;
  newStartDate: string;
  newEndDate: string;
  reason: string;
  note: string | null;
  createdAt: string;
  changedBy: { id: string; name: string } | null;
  // Legacy rows persisted this as a bare array (no cross-project detection yet) — accept both shapes.
  downstreamImpactedJson: { tasks?: unknown[]; crossProjectImpact?: CrossProjectImpactEntry[] } | unknown[] | null;
};

/** Inline per-task change history (FEEDBACK_NOTES §8) — shown on the task itself, not only the central Audit Log. */
export function DelayHistoryList({ projectId, activityId }: { projectId: string; activityId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["projects", projectId, "activities", activityId, "delay-history"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/activities/${activityId}/delay-history`);
      if (!res.ok) throw new Error("Failed to load delay history");
      return (await res.json()) as { delayRecords: DelayRecordRow[] };
    },
  });

  const records = data?.delayRecords ?? [];

  if (isLoading) return null;
  if (records.length === 0) {
    return <p className="text-xs text-muted-foreground">No date changes recorded for this task yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {records.map((r) => {
        const crossProjectImpact = Array.isArray(r.downstreamImpactedJson) ? [] : r.downstreamImpactedJson?.crossProjectImpact ?? [];
        return (
          <li key={r.id} className="flex gap-2 rounded-lg border border-border p-2 text-xs">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-foreground">
                {formatDate(r.previousEndDate)} → <span className="font-medium">{formatDate(r.newEndDate)}</span>
                <span className="ml-2 rounded-full bg-rag-amber/15 px-1.5 py-0.5 font-medium text-rag-amber">{r.reason}</span>
              </p>
              {r.note && <p className="mt-0.5 text-muted-foreground">{r.note}</p>}
              <p className="mt-0.5 text-muted-foreground">
                {formatDate(r.createdAt)}
                {r.changedBy ? ` · ${r.changedBy.name}` : ""}
              </p>
              {crossProjectImpact.length > 0 && (
                <div className="mt-1 flex items-start gap-1 text-rag-red">
                  <Users className="mt-0.5 size-3 shrink-0" />
                  <ul>
                    {crossProjectImpact.map((c) => (
                      <li key={`${c.workerId}-${c.otherProjectId}`}>
                        {c.workerName} also booked on {c.otherProjectName} ({c.conflictWeeks.length} wk
                        {c.conflictWeeks.length === 1 ? "" : "s"})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
