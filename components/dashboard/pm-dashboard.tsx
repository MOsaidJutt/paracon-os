"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from "recharts";
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
import { Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { ProjectHealthBadge } from "@/components/dashboard/project-health-badge";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { SortableWidget } from "@/components/dashboard/sortable-widget";
import { useDashboardLayout } from "@/components/dashboard/use-dashboard-layout";
import { DASHBOARD_WIDGETS } from "@/lib/dashboard/widget-registry";
import { StaffScorecardPanel } from "@/components/scorecard/staff-scorecard-panel";
import { formatDate } from "@/lib/tenders/format";
import type { Alert } from "@/lib/dashboard/alerts";
import type { ProjectHealthStatus } from "@/lib/dashboard/health";

type ProjectHealthRow = { id: string; name: string; code: string; status: ProjectHealthStatus; reasons: string[] };
type LookaheadActivity = {
  id: string;
  name: string;
  trade: string;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
};
type LabourWeekRow = { week: string; trade: string; demand: number; allocated: number };
type DeliveryStatusRow = { status: string; count: number };
type OpenIssueRow = {
  id: string;
  description: string;
  severity: string;
  isCritical: boolean;
  status: string;
  projectId: string;
  projectName: string;
};
type PmDashboardResponse = {
  projects: ProjectHealthRow[];
  lookahead: LookaheadActivity[];
  labour: LabourWeekRow[];
  deliveries: DeliveryStatusRow[];
  openIssues: OpenIssueRow[];
  alerts: Alert[];
};

const TITLE_BY_ID = Object.fromEntries(DASHBOARD_WIDGETS.pm.map((w) => [w.id, w.title]));
const FULL_WIDTH_IDS = new Set(["my-projects", "scorecard"]);

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}

function aggregateLabourByTrade(rows: LabourWeekRow[]): { trade: string; demand: number; allocated: number }[] {
  const byTrade = new Map<string, { trade: string; demand: number; allocated: number }>();
  for (const row of rows) {
    const entry = byTrade.get(row.trade) ?? { trade: row.trade, demand: 0, allocated: 0 };
    entry.demand += row.demand;
    entry.allocated += row.allocated;
    byTrade.set(row.trade, entry);
  }
  return Array.from(byTrade.values());
}

export function PmDashboard({ canAssessScorecard }: { canAssessScorecard: boolean }) {
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const { layout, isLoading: layoutLoading, editing, setDraft, startEditing, finishEditing, isSaving } =
    useDashboardLayout("pm");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard", "pm", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/pm${projectId ? `?projectId=${projectId}` : ""}`);
      if (!res.ok) throw new Error("Failed to load the PM dashboard");
      return (await res.json()) as PmDashboardResponse;
    },
  });

  // Once a project is selected, `data` above is itself filtered down to one
  // project, so the filter dropdown needs a separate unfiltered fetch to keep
  // its full option list. Before that, `data.projects` (unfiltered) already
  // has everything the dropdown needs — no second request required.
  const { data: allProjects } = useQuery({
    queryKey: ["dashboard", "pm", "all-projects"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/pm");
      if (!res.ok) throw new Error("Failed to load projects");
      return (await res.json()) as PmDashboardResponse;
    },
    enabled: projectId !== undefined,
  });

  const projectOptions = projectId === undefined ? data?.projects ?? [] : allProjects?.projects ?? [];
  const chartData = data ? aggregateLabourByTrade(data.labour) : [];

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

  function renderWidget(id: string, d: PmDashboardResponse) {
    switch (id) {
      case "my-projects":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My projects</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {d.projects.map((p) => (
                <Badge key={p.id} variant="outline" className="gap-1.5">
                  {p.name}
                  <ProjectHealthBadge status={p.status} />
                </Badge>
              ))}
            </CardContent>
          </Card>
        );
      case "lookahead":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3-week look-ahead</CardTitle>
              <CardDescription>Upcoming activities across your projects.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.lookahead.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities in the next 3 weeks.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {d.lookahead.map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {a.projectName} — {a.name} <span className="text-muted-foreground">({a.trade})</span>
                      </span>
                      <span className="text-muted-foreground">{formatDate(a.startDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      case "labour-chart":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Labour required vs allocated</CardTitle>
              <CardDescription>Headcount by trade, summed over the look-ahead window.</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No labour demand in this window.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="trade" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Legend />
                      <Bar dataKey="demand" name="Required" fill="#6b4f43" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="allocated" name="Allocated" fill="#ddc8b8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "deliveries":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery status</CardTitle>
            </CardHeader>
            <CardContent>
              {d.deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliveries tracked yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {d.deliveries.map((delivery) => (
                    <Badge key={delivery.status} variant="outline">
                      {delivery.status}: {delivery.count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "open-issues":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open issues</CardTitle>
            </CardHeader>
            <CardContent>
              {d.openIssues.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open issues.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {d.openIssues.map((issue) => (
                    <li key={issue.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {issue.projectName} — {issue.description}
                      </span>
                      <Badge variant={issue.isCritical ? "destructive" : "outline"}>{issue.severity}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
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
        <DashboardFilters projects={projectOptions} projectId={projectId} onProjectChange={setProjectId} />
        {/* finishEditing is wrapped rather than passed by reference: it takes an
            optional layout, so handing it straight to onClick would pass the
            click event as the thing to persist. */}
        {!isLoading && data && data.projects.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={editing ? () => finishEditing() : startEditing}
            disabled={isSaving}
          >
            <Settings2 className="size-4" />
            {editing ? (isSaving ? "Saving..." : "Done") : "Customize"}
          </Button>
        )}
      </div>

      {isLoading || layoutLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <QueryErrorState message="Failed to load the dashboard." onRetry={() => refetch()} isRetrying={isRefetching} />
      ) : data.projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects assigned to you yet.</p>
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
                  className={FULL_WIDTH_IDS.has(w.id) ? "lg:col-span-2" : undefined}
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
