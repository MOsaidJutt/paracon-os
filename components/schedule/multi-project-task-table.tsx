"use client";

import { Fragment } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/tenders/format";
import type { GanttStatus } from "@/lib/schedule/gantt-status";

export type CrossProjectImpactEntry = {
  workerId: string;
  workerName: string;
  otherProjectId: string;
  otherProjectName: string;
  conflictWeeks: string[];
};

export type MultiProjectTaskRow = {
  id: string;
  name: string;
  responsible: string | null;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  startDate: string;
  endDate: string;
  ganttStatus: GanttStatus;
  delayDays: number | null;
  impactReason: string | null;
  predecessorName: string | null;
  crossProjectImpact: CrossProjectImpactEntry[];
  projectId: string;
  projectName: string;
  projectCode: string;
};

function StatusBadge({ status }: { status: GanttStatus }) {
  if (status === "On Track") return <Badge variant="success">On Track</Badge>;
  if (status === "At Risk") return <Badge variant="warning">At Risk</Badge>;
  return <Badge variant="destructive">Behind</Badge>;
}

function DelayCell({ delayDays }: { delayDays: number | null }) {
  if (delayDays === null) return <span className="text-muted-foreground">—</span>;
  if (delayDays <= 0) return <span className="text-muted-foreground">On time</span>;
  return <span className="font-medium text-rag-red">+{delayDays}d</span>;
}

function SnowballBadge({ impact }: { impact: CrossProjectImpactEntry[] }) {
  if (impact.length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-0.5 rounded-full bg-rag-red/15 px-1.5 py-0.5 text-[10px] font-medium text-rag-red">
          <Users className="size-3" />
          {impact.length}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">
        <p className="mb-1 font-medium">Shared labour also booked elsewhere</p>
        {impact.map((c) => (
          <p key={`${c.workerId}-${c.otherProjectId}`}>
            {c.workerName} — also on {c.otherProjectName} ({c.conflictWeeks.length} wk
            {c.conflictWeeks.length === 1 ? "" : "s"})
          </p>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The 10-column task table (Peter's exact spec) for the multi-project stacked
 * Gantt's Simplified view: Activity / Responsible / Baseline Start /
 * Baseline Finish / Current Start / Current Finish / Status / Delay / Impact
 * Reason / Linked Predecessor. Grouped by project so the multi-project
 * context (which the Gantt timeline conveys visually via colour) isn't lost
 * in a flat list. The snowball badge reads the already-computed cross-project
 * impact stored on the latest DelayRecord — never recomputed here.
 */
export function MultiProjectTaskTable({ rows }: { rows: MultiProjectTaskRow[] }) {
  const projectOrder: { id: string; code: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!seen.has(r.projectId)) {
      seen.add(r.projectId);
      projectOrder.push({ id: r.projectId, code: r.projectCode, name: r.projectName });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No project activities scheduled this month.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activity</TableHead>
              <TableHead>Responsible</TableHead>
              <TableHead>Baseline Start</TableHead>
              <TableHead>Baseline Finish</TableHead>
              <TableHead>Current Start</TableHead>
              <TableHead>Current Finish</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delay</TableHead>
              <TableHead>Impact Reason</TableHead>
              <TableHead>Linked Predecessor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectOrder.map((project) => (
              <Fragment key={project.id}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={10} className="font-heading text-xs font-semibold text-foreground">
                    {project.code} — {project.name}
                  </TableCell>
                </TableRow>
                {rows
                  .filter((r) => r.projectId === project.id)
                  .map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          {row.name}
                          <SnowballBadge impact={row.crossProjectImpact} />
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.responsible ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.baselineStartDate ? formatDate(row.baselineStartDate) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.baselineEndDate ? formatDate(row.baselineEndDate) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(row.startDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(row.endDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.ganttStatus} />
                      </TableCell>
                      <TableCell>
                        <DelayCell delayDays={row.delayDays} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.impactReason ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{row.predecessorName ?? "—"}</TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
