"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { CapacityHeadroomCard } from "@/components/forecast/capacity-headroom";
import { ProjectRowHoverCard } from "@/components/dashboard/project-row-hover-card";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { SortableWidget } from "@/components/dashboard/sortable-widget";
import { useDashboardLayout } from "@/components/dashboard/use-dashboard-layout";
import { DASHBOARD_WIDGETS } from "@/lib/dashboard/widget-registry";
import { StaffScorecardPanel } from "@/components/scorecard/staff-scorecard-panel";
import { ScoreGauge, bandForScore } from "@/components/scorecard/score-gauge";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import type { CapacityHeadroom } from "@/lib/forecast/engine";
import type { Alert } from "@/lib/dashboard/alerts";
import type { ProjectHealthStatus } from "@/lib/dashboard/health";

type ProjectHealthRow = { id: string; name: string; code: string; status: ProjectHealthStatus; reasons: string[] };
type DirectorDashboardResponse = {
  projects: ProjectHealthRow[];
  atRisk: ProjectHealthRow[];
  criticalDates: { id: string; name: string; date: string; project: { id: string; name: string; code: string } }[];
  capacity: CapacityHeadroom;
  pipeline: { weightedPipeline: number; totalPipeline: number; activeBids: number; winRateValue: number };
  alerts: Alert[];
};
type ProjectsResponse = { projects: { id: string; name: string; code: string }[] };

const TITLE_BY_ID = Object.fromEntries(DASHBOARD_WIDGETS.director.map((w) => [w.id, w.title]));

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}

function CriticalDatesCard({ criticalDates }: { criticalDates: DirectorDashboardResponse["criticalDates"] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? criticalDates : criticalDates.slice(0, 5);
  const remaining = criticalDates.length - visible.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Critical dates — next 30 days</CardTitle>
        <CardDescription>Auto-derived from critical activities across every project.</CardDescription>
      </CardHeader>
      <CardContent>
        {criticalDates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No critical dates in the next 30 days.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {visible.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {m.project.name} <span className="text-muted-foreground">({m.project.code})</span> — {m.name}
                  </span>
                  <span className="text-muted-foreground">{formatDate(m.date)}</span>
                </li>
              ))}
            </ul>
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-2 flex items-center gap-1 text-sm font-medium text-brass hover:underline"
              >
                <ChevronRight className="size-4" /> Show {remaining} more
              </button>
            )}
            {showAll && criticalDates.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="mt-2 flex items-center gap-1 text-sm font-medium text-brass hover:underline"
              >
                <ChevronDown className="size-4" /> Show fewer
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DirectorDashboard({ canAssessScorecard }: { canAssessScorecard: boolean }) {
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const { layout, isLoading: layoutLoading, editing, setDraft, startEditing, finishEditing, isSaving } =
    useDashboardLayout("director");

  const { data: projectOptions } = useQuery({
    queryKey: ["projects", "options"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return (await res.json()) as ProjectsResponse;
    },
  });

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard", "director", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/director${projectId ? `?projectId=${projectId}` : ""}`);
      if (!res.ok) throw new Error("Failed to load the Director dashboard");
      return (await res.json()) as DirectorDashboardResponse;
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const newIndex = prev.findIndex((w) => w.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function renderWidget(id: string, d: DirectorDashboardResponse) {
    switch (id) {
      case "project-health":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project health</CardTitle>
              <CardDescription>On Track / Attention / Critical, derived from dates, issues and labour cover. Hover a project for why.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects yet.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {d.projects.map((p) => (
                    <li key={p.id}>
                      <ProjectRowHoverCard {...p} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      case "at-risk":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">At-risk projects</CardTitle>
              <CardDescription>Attention/Critical projects, worst first. Hover for the reason.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.atRisk.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {d.projects.length === 0 ? "No projects yet." : "Nothing at risk — every project is On Track."}
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {d.atRisk.map((p) => (
                    <li key={p.id}>
                      <ProjectRowHoverCard {...p} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      case "critical-dates":
        return <CriticalDatesCard criticalDates={d.criticalDates} />;
      case "pipeline": {
        const winRateScore = Math.round(d.pipeline.winRateValue * 100);
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline snapshot</CardTitle>
              <CardDescription>Tender pipeline weighted by win probability.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="grid flex-1 grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Weighted pipeline</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(d.pipeline.weightedPipeline)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total pipeline</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(d.pipeline.totalPipeline)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active bids</p>
                  <p className="text-lg font-semibold text-foreground">{d.pipeline.activeBids}</p>
                </div>
              </div>
              <ScoreGauge value={winRateScore} band={bandForScore(winRateScore, 50, 25)} size={84} label="Win rate" />
            </CardContent>
          </Card>
        );
      }
      case "capacity":
        return <CapacityHeadroomCard headroom={d.capacity} />;
      case "alerts":
        return <AlertsPanel alerts={d.alerts} />;
      case "scorecard":
        return <StaffScorecardPanel canAssess={canAssessScorecard} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <DashboardFilters projects={projectOptions?.projects ?? []} projectId={projectId} onProjectChange={setProjectId} />
        {!isLoading && data && (
          <Button variant="outline" size="sm" onClick={editing ? finishEditing : startEditing} disabled={isSaving}>
            <Settings2 className="size-4" />
            {editing ? (isSaving ? "Saving..." : "Done") : "Customize"}
          </Button>
        )}
      </div>

      {isLoading || layoutLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <QueryErrorState message="Failed to load the dashboard." onRetry={() => refetch()} isRetrying={isRefetching} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={layout.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 lg:grid-cols-2">
              {layout.map((w) => (
                <SortableWidget
                  key={w.id}
                  id={w.id}
                  editing={editing}
                  visible={w.visible}
                  onToggleVisible={() =>
                    setDraft((prev) =>
                      prev ? prev.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)) : prev
                    )
                  }
                  className={w.id === "scorecard" ? "lg:col-span-2" : undefined}
                >
                  {editing && (
                    <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{TITLE_BY_ID[w.id] ?? w.id}</p>
                  )}
                  {renderWidget(w.id, data)}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
