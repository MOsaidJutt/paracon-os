"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gantt, ViewMode, type Task } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { DelayReasonDialog, type DownstreamImpactedRow } from "@/components/schedule/delay-reason-dialog";
import { GanttViewMenu, type BaselineOption } from "@/components/schedule/gantt-view-menu";

export type ProgramActivityRow = {
  id: string;
  parentId: string | null;
  name: string;
  trade: string;
  startDate: string;
  endDate: string;
  isCritical: boolean;
  status: string;
};

type DependencyEdge = { predecessorId: string; successorId: string };

type BaselineTaskRow = { activityId: string; name: string; startDate: string; endDate: string };

const TRADE_COLORS: Record<string, string> = {
  Carpenter: "#6b4f43",
  Electrician: "#4F6B82",
  Plumber: "#2E7D32",
  Plasterer: "#6B5A78",
  Painter: "#ED9B11",
  "Site Labourer": "#8ea0af",
  "Project Engineer": "#1C1B17",
};

// The gantt task list always renders 3 columns: Name, From, To — each
// gets listCellWidth. Total task-list panel = cellWidth × 3.
const TASK_LIST_COLUMNS = 3;
const CELL_MIN = 100;
const CELL_MAX = 480;

function colorForTrade(trade: string): string {
  return TRADE_COLORS[trade] ?? "#4F6B82";
}

function autoFitCellWidth(activities: ProgramActivityRow[]): number {
  if (activities.length === 0) return 180;
  // ~7.5 px per character in the name column + 32 px padding/icon room.
  const maxLen = Math.max(...activities.map((a) => a.name.length), 8);
  return Math.min(Math.max(Math.round(maxLen * 7.5) + 32, 150), CELL_MAX);
}

type PendingMove = {
  activityId: string;
  taskName: string;
  previousEndDate: string;
  newStartDate: string;
  newEndDate: string;
  downstreamImpacted: DownstreamImpactedRow[];
};

export function GanttView({
  projectId,
  activities,
  dependencies,
  canEdit,
  baselines,
}: {
  projectId: string;
  activities: ProgramActivityRow[];
  dependencies: DependencyEdge[];
  canEdit: boolean;
  baselines: BaselineOption[];
}) {
  const queryClient = useQueryClient();
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(baselines[0]?.id ?? null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Column width: auto-fit by default, overridable by dragging ──────────
  const [userCellWidth, setUserCellWidth] = useState<number | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartCellWidth = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleActivities = criticalOnly ? activities.filter((a) => a.isCritical) : activities;

  // Recalculate auto-fit when activities change; reset user override so the
  // chart adapts when tasks are added/renamed.
  const computedAutoFit = useMemo(() => autoFitCellWidth(visibleActivities), [visibleActivities]);
  const cellWidth = userCellWidth ?? computedAutoFit;

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    // Each pixel of horizontal drag moves the boundary by 1 px total, but
    // listCellWidth affects all 3 columns, so we divide the delta by 3.
    const delta = (e.clientX - dragStartX.current) / TASK_LIST_COLUMNS;
    const next = Math.min(CELL_MAX, Math.max(CELL_MIN, dragStartCellWidth.current + delta));
    setUserCellWidth(next);
  }, []);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [onMouseMove]);

  // Clean up global listeners on unmount.
  useEffect(() => () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove, onMouseUp]);

  function startResize(e: React.MouseEvent) {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartCellWidth.current = cellWidth;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }

  function resetToAutoFit() {
    setUserCellWidth(null);
  }

  const { data: scheduleConfig } = useQuery({
    queryKey: ["schedule", "config"],
    queryFn: async () => {
      const res = await fetch("/api/schedule/config");
      if (!res.ok) throw new Error("Failed to load schedule config");
      return (await res.json()) as { delayReasonList: string[] };
    },
  });

  const { data: baselineDetail } = useQuery({
    queryKey: ["projects", projectId, "baselines", selectedBaselineId],
    enabled: showBaseline && !!selectedBaselineId,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/baselines/${selectedBaselineId}`);
      if (!res.ok) throw new Error("Failed to load baseline");
      return (await res.json()) as { baseline: { tasks: BaselineTaskRow[] } };
    },
  });

  const dependenciesBySuccessor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const dep of dependencies) {
      const list = map.get(dep.successorId) ?? [];
      list.push(dep.predecessorId);
      map.set(dep.successorId, list);
    }
    return map;
  }, [dependencies]);

  const tasks: Task[] = useMemo(() => {
    const result: Task[] = [];
    const visibleIds = new Set(visibleActivities.map((a) => a.id));

    for (const a of visibleActivities) {
      if (showBaseline && baselineDetail) {
        const baselineTask = baselineDetail.baseline.tasks.find((t) => t.activityId === a.id);
        if (baselineTask) {
          result.push({
            id: `baseline-${a.id}`,
            type: "task",
            name: `Baseline: ${baselineTask.name}`,
            start: new Date(baselineTask.startDate),
            end: new Date(baselineTask.endDate),
            progress: 0,
            isDisabled: true,
            styles: {
              backgroundColor: "#ddc8b8",
              backgroundSelectedColor: "#ddc8b8",
              progressColor: "#ddc8b8",
            },
          });
        }
      }

      const isCriticalNow = showCriticalPath && a.isCritical;
      result.push({
        id: a.id,
        type: "task",
        name: isCriticalNow ? `${a.name} ★` : a.name,
        start: new Date(a.startDate),
        end: new Date(a.endDate),
        progress: a.status === "Complete" ? 100 : 0,
        isDisabled: !canEdit,
        dependencies: (dependenciesBySuccessor.get(a.id) ?? []).filter((id) => visibleIds.has(id)),
        styles: {
          backgroundColor: colorForTrade(a.trade),
          backgroundSelectedColor: colorForTrade(a.trade),
          progressColor: isCriticalNow ? "#C62828" : colorForTrade(a.trade),
        },
      });
    }
    return result;
  }, [visibleActivities, dependenciesBySuccessor, showBaseline, baselineDetail, showCriticalPath, canEdit]);

  async function handleDateChange(task: Task): Promise<boolean> {
    const activity = activities.find((a) => a.id === task.id);
    if (!activity || !canEdit) return false;

    try {
      const res = await fetch(`/api/projects/${projectId}/activities/${task.id}/preview-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: task.start, endDate: task.end }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to preview the move");
        return false;
      }
      const preview = (await res.json()) as { requiresReason: boolean; downstreamImpacted: DownstreamImpactedRow[] };

      if (!preview.requiresReason) {
        await commitMove(task.id, task.start.toISOString(), task.end.toISOString());
        return true;
      }

      setPendingMove({
        activityId: task.id,
        taskName: activity.name,
        previousEndDate: activity.endDate,
        newStartDate: task.start.toISOString(),
        newEndDate: task.end.toISOString(),
        downstreamImpacted: preview.downstreamImpacted,
      });
      return false;
    } catch {
      toast.error("Failed to preview the move");
      return false;
    }
  }

  async function commitMove(activityId: string, startDate: string, endDate: string, reason?: string, note?: string) {
    const res = await fetch(`/api/projects/${projectId}/activities/${activityId}/commit-move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, reason, note: note || undefined }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to save the new date");
    }
    queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
  }

  if (activities.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Add an activity to see the program on a Gantt chart.
      </div>
    );
  }

  // The resize handle sits at the right edge of the task list panel.
  // listCellWidth × 3 columns = total task-list pixel width.
  const handleLeft = Math.round(cellWidth * TASK_LIST_COLUMNS);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <GanttViewMenu
          showCriticalPath={showCriticalPath}
          onShowCriticalPathChange={setShowCriticalPath}
          criticalOnly={criticalOnly}
          onCriticalOnlyChange={setCriticalOnly}
          baselines={baselines}
          selectedBaselineId={selectedBaselineId}
          onSelectedBaselineIdChange={setSelectedBaselineId}
          showBaseline={showBaseline}
          onShowBaselineChange={setShowBaseline}
        />
      </div>

      <div ref={containerRef} className="relative overflow-x-auto rounded-lg border border-border">
        {/* ── Column resize handle ──────────────────────────────────────────
            Positioned at the task-list / timeline boundary.
            Drag left/right to resize all columns proportionally.
            Double-click to snap back to auto-fit.                         */}
        <div
          role="separator"
          aria-label="Resize task list columns"
          style={{ left: `${handleLeft}px` }}
          className="absolute top-0 bottom-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize items-center justify-center group"
          onMouseDown={startResize}
          onDoubleClick={resetToAutoFit}
          title="Drag to resize · Double-click to auto-fit"
        >
          {/* Visible bar — thickens on hover */}
          <div className="h-full w-0.5 bg-border transition-all group-hover:w-1 group-hover:bg-[#6b4f43]" />
          {/* Grip dots */}
          <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {[0,1,2].map((i) => (
              <div key={i} className="h-1 w-1 rounded-full bg-[#6b4f43]" />
            ))}
          </div>
        </div>

        <Gantt
          tasks={tasks}
          viewMode={ViewMode.Week}
          listCellWidth={`${Math.round(cellWidth)}px`}
          columnWidth={65}
          barCornerRadius={4}
          todayColor="rgba(176, 141, 87, 0.15)"
          arrowColor={showCriticalPath ? "#C62828" : "#8ea0af"}
          onDateChange={handleDateChange}
        />
      </div>

      {pendingMove && (
        <DelayReasonDialog
          open={!!pendingMove}
          onOpenChange={(open) => {
            if (!open) setPendingMove(null);
          }}
          taskName={pendingMove.taskName}
          previousEndDate={pendingMove.previousEndDate}
          newEndDate={pendingMove.newEndDate}
          downstreamImpacted={pendingMove.downstreamImpacted}
          reasonOptions={scheduleConfig?.delayReasonList ?? []}
          isSaving={isSaving}
          onCancel={() => setPendingMove(null)}
          onConfirm={async (reason, note) => {
            setIsSaving(true);
            try {
              await commitMove(pendingMove.activityId, pendingMove.newStartDate, pendingMove.newEndDate, reason, note);
              toast.success("Date updated");
              setPendingMove(null);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to save the new date");
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}
