"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Gantt, ViewMode, type Task } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/tenders/format";
import { MultiProjectTaskTable, type CrossProjectImpactEntry } from "./multi-project-task-table";
import type { GanttStatus } from "@/lib/schedule/gantt-status";

type CalendarActivity = {
  id: string;
  parentId: string | null;
  name: string;
  trade: string;
  startDate: string;
  endDate: string;
  isCritical: boolean;
  status: string;
  responsible: string | null;
  projectId: string;
  projectName: string;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  delayDays: number | null;
  ganttStatus: GanttStatus;
  impactReason: string | null;
  predecessorName: string | null;
  crossProjectImpact: CrossProjectImpactEntry[];
};

type CalendarProject = { id: string; name: string; code: string; status: string };

type DemandCell = {
  week: string;
  role: string;
  demand: number;
  supply: number;
  status: "Covered" | "Watch" | "Short";
  severity: "normal" | "critical";
};

type CalendarResponse = {
  projects: CalendarProject[];
  activities: CalendarActivity[];
  weeks: string[];
  roles: string[];
  demandCells: DemandCell[];
};

const PROJECT_COLORS = ["#6b4f43", "#4F6B82", "#2E7D32", "#6B5A78", "#ED9B11", "#8ea0af", "#1C1B17", "#C62828"];

function colorForIndex(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function DemandBadge({ cell }: { cell: DemandCell }) {
  if (cell.status === "Covered") return <Badge variant="success">{cell.demand}</Badge>;
  if (cell.status === "Watch")
    return (
      <Badge variant="warning">
        {cell.demand} / {cell.supply}
      </Badge>
    );
  return (
    <Badge variant="destructive" className={cell.severity === "critical" ? "ring-2 ring-destructive/40" : undefined}>
      {cell.demand} / {cell.supply}
    </Badge>
  );
}

/**
 * The literal "stacked multi-project Gantt" ask: every active project's
 * program in ONE gantt-task-react timeline, grouped under a project row
 * (type "project", the library's native group-header row) and coloured by
 * project — not a separate calendar. Above the timeline, a combined
 * labour-by-trade-over-time strip (reusing the same aggregateCombinedDemand
 * + RAG classification the Forecast matrix and Resource Planner use) shows
 * where total demand across all stacked projects exceeds capacity.
 *
 * `simplified` opts into the Module 4 additions (two-bar baseline/current
 * comparison, RAG status, delay, cross-project snowball badge, 10-column
 * task table) built for the Simplified Projects view. Full's existing
 * /projects/schedule caller omits it, so Full renders exactly what it did
 * before — nothing already built changes for Full.
 */
export function MultiProjectGanttView({ simplified = false }: { simplified?: boolean } = {}) {
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [showBaseline, setShowBaseline] = useState(true);
  const baselineActive = simplified && showBaseline;

  const from = monthAnchor;
  const to = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0));

  const { data, isLoading } = useQuery({
    queryKey: ["schedule", "calendar", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const res = await fetch(`/api/schedule/calendar?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load schedule");
      return (await res.json()) as CalendarResponse;
    },
  });

  const projects = data?.projects ?? [];

  const tasks: Task[] = useMemo(() => {
    const projects = data?.projects ?? [];
    const activities = data?.activities ?? [];
    const result: Task[] = [];

    projects.forEach((project, index) => {
      const projectActivities = activities.filter((a) => a.projectId === project.id);
      if (projectActivities.length === 0) return;

      const color = colorForIndex(index);
      const starts = projectActivities.map((a) => new Date(a.startDate).getTime());
      const ends = projectActivities.map((a) => new Date(a.endDate).getTime());
      const groupId = `project-${project.id}`;

      result.push({
        id: groupId,
        type: "project",
        name: `${project.code} — ${project.name}`,
        start: new Date(Math.min(...starts)),
        end: new Date(Math.max(...ends)),
        progress: 0,
        isDisabled: true,
        styles: { backgroundColor: color, backgroundSelectedColor: color, progressColor: color },
      });

      for (const activity of projectActivities) {
        // Diverged from baseline: colour the current bar red instead of the
        // project colour — this doubles as the "red divergence" callout
        // (FEEDBACK_NOTES §6) without a custom connector overlay. Full-view
        // callers never diverge or show baseline rows — see `simplified` above.
        const diverged = simplified && (activity.delayDays ?? 0) > 0;

        if (baselineActive && activity.baselineStartDate && activity.baselineEndDate) {
          result.push({
            id: `baseline-${activity.id}`,
            type: "task",
            name: `Baseline: ${activity.name}`,
            start: new Date(activity.baselineStartDate),
            end: new Date(activity.baselineEndDate),
            progress: 0,
            isDisabled: true,
            project: groupId,
            styles: {
              backgroundColor: "#ddc8b8",
              backgroundSelectedColor: "#ddc8b8",
              progressColor: "#ddc8b8",
            },
          });
        }

        result.push({
          id: activity.id,
          type: "task",
          name: activity.isCritical ? `${activity.name} ★` : activity.name,
          start: new Date(activity.startDate),
          end: new Date(activity.endDate),
          progress: 0,
          isDisabled: true,
          project: groupId,
          styles: {
            backgroundColor: diverged ? "#C62828" : color,
            backgroundSelectedColor: diverged ? "#C62828" : color,
            progressColor: activity.isCritical ? "#C62828" : color,
          },
        });
      }
    });
    return result;
  }, [data, simplified, baselineActive]);

  const weeks = data?.weeks ?? [];
  const roles = data?.roles ?? [];
  const cellByKey = new Map((data?.demandCells ?? []).map((c) => [`${c.week}::${c.role}`, c]));

  const codeByProject = new Map(projects.map((p) => [p.id, p.code]));
  const taskRows = (data?.activities ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    responsible: a.responsible,
    baselineStartDate: a.baselineStartDate,
    baselineEndDate: a.baselineEndDate,
    startDate: a.startDate,
    endDate: a.endDate,
    ganttStatus: a.ganttStatus,
    delayDays: a.delayDays,
    impactReason: a.impactReason,
    predecessorName: a.predecessorName,
    crossProjectImpact: a.crossProjectImpact,
    projectId: a.projectId,
    projectName: a.projectName,
    projectCode: codeByProject.get(a.projectId) ?? "",
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthAnchor(new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() - 1, 1)))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-36 text-center font-heading text-sm font-semibold text-foreground">
          {monthAnchor.toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthAnchor(new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 1)))}
        >
          <ChevronRight className="size-4" />
        </Button>

        {simplified && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-foreground">Show baseline</span>
            <Switch checked={showBaseline} onCheckedChange={setShowBaseline} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {projects.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: colorForIndex(i) }} />
            {p.code} — {p.name}
          </span>
        ))}
        {baselineActive && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: "#ddc8b8" }} />
            Baseline
          </span>
        )}
        {simplified && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rag-red" />
            Behind baseline
          </span>
        )}
      </div>

      {roles.length > 0 && weeks.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Total labour demand by trade</TableHead>
                {weeks.map((week) => (
                  <TableHead key={week} className="text-center text-[11px] font-normal text-muted-foreground">
                    {formatDate(week)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role}>
                  <TableHead className="font-medium text-foreground">{role}</TableHead>
                  {weeks.map((week) => {
                    const cell = cellByKey.get(`${week}::${role}`);
                    return (
                      <TableCell key={week} className="text-center">
                        {cell && cell.demand > 0 && <DemandBadge cell={cell} />}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading schedule...</p>
      ) : tasks.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          No project activities scheduled this month.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Gantt
            tasks={tasks}
            viewMode={ViewMode.Week}
            listCellWidth="220px"
            columnWidth={65}
            barCornerRadius={4}
            todayColor="rgba(176, 141, 87, 0.15)"
          />
        </div>
      )}

      {simplified && <MultiProjectTaskTable rows={taskRows} />}
    </div>
  );
}
