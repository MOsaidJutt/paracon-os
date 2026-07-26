"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useDashboardLayout } from "@/components/dashboard/use-dashboard-layout";
import { KpiRingRow } from "./kpi-ring-row";
import { ProjectHealthCard } from "./project-health-card";
import { CapacityCard } from "./capacity-card";
import { AlertsCard } from "./alerts-card";
import { ChecklistCard } from "./checklist-card";
import { BarsCard } from "./bars-card";
import { WorkerKpiCard } from "./worker-kpi-card";
import { CriticalDatesCard, PipelineFiguresCard } from "./figures-card";
import { CustomisePanel } from "./customise-panel";
import type { SimpleDashboard as SimpleDashboardData } from "@/lib/dashboard/simple-service";

/**
 * The simplified dashboard: a full business snapshot in about three minutes.
 *
 * It reads top to bottom as three questions — are we winning work (the rings),
 * can we deliver it (project health and capacity), what needs me today (alerts,
 * checklist, worker KPIs). Nothing on this page navigates away: every card
 * opens its detail in a slide-over beside the page, because the whole point is
 * that a director can interrogate a number without losing the overview.
 *
 * Every figure here comes from the services the Full view already uses. This
 * component owns presentation and nothing else.
 */
export function SimpleDashboard({
  userName,
  canEditSettings,
}: {
  userName: string;
  /** Gates the "Change the target" action in a ring's panel — the target is an org Config row. */
  canEditSettings: boolean;
}) {
  const [customising, setCustomising] = useState(false);
  const { layout, isLoading: layoutLoading, draft, setDraft, startEditing, finishEditing, isSaving } =
    useDashboardLayout("simple");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard", "simple"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/simple");
      if (!res.ok) throw new Error("Failed to load the dashboard");
      return (await res.json()) as SimpleDashboardData;
    },
  });

  function openCustomise() {
    startEditing();
    setCustomising(true);
  }

  function closeCustomise(open: boolean) {
    setCustomising(open);
    if (!open) setDraft(null);
  }

  if (isLoading || layoutLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return (
      <QueryErrorState
        message="We couldn't load your dashboard."
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    );
  }

  const activeLayout = customising && draft ? draft : layout;
  const shown = activeLayout.filter((w) => w.visible && data.visibleWidgets.includes(w.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {greeting()}, {userName.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{today()}</p>
        </div>
        <Button variant="outline" size="sm" onClick={openCustomise}>
          <Settings2 className="size-4" />
          Customise
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Your dashboard is empty"
          description="Everything is switched off, or there's nothing recorded yet for the parts your role covers."
          action={{ label: "Choose what to show", onClick: openCustomise }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((widget) => (
            <div key={widget.id} className={widget.id === "kpi-rings" ? "lg:col-span-2" : undefined}>
              {renderWidget(widget.id, data, canEditSettings)}
            </div>
          ))}
        </div>
      )}

      <CustomisePanel
        open={customising}
        onOpenChange={closeCustomise}
        layout={activeLayout}
        onLayoutChange={setDraft}
        onSave={finishEditing}
        isSaving={isSaving}
        availableWidgetIds={data.visibleWidgets}
      />
    </div>
  );
}

function renderWidget(id: string, data: SimpleDashboardData, canEditSettings: boolean) {
  switch (id) {
    case "kpi-rings":
      return <KpiRingRow rings={data.rings} canEditSettings={canEditSettings} />;
    case "project-health":
      return <ProjectHealthCard projects={data.projects} />;
    case "capacity":
      return data.capacity ? <CapacityCard capacity={data.capacity} /> : null;
    case "alerts":
      return <AlertsCard alerts={data.alerts} />;
    case "checklist":
      return <ChecklistCard checklist={data.checklist} />;
    case "worker-kpis":
      return <WorkerKpiCard bars={data.workerKpis} />;
    case "role-scorecard":
      return (
        <BarsCard
          title="Scorecard by trade"
          description="Average monthly staff score, best first."
          bars={data.roleScorecard}
          emptyTitle="Nobody assessed yet"
          emptyDescription="Mark a worker as key staff and assess them to see their trade here."
        />
      );
    case "critical-dates":
      return <CriticalDatesCard criticalDates={data.criticalDates} />;
    case "pipeline":
      return data.pipeline ? <PipelineFiguresCard pipeline={data.pipeline} /> : null;
    default:
      return null;
  }
}

function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function today(now: Date = new Date()): string {
  return now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-44 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    </div>
  );
}
