"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CapacityHeadroomCard } from "@/components/forecast/capacity-headroom";
import { ProjectHealthBadge } from "@/components/dashboard/project-health-badge";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { StaffScorecardPanel } from "@/components/scorecard/staff-scorecard-panel";
import { formatCurrency, formatDate, formatPercent } from "@/lib/tenders/format";
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

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}

export function DirectorDashboard({ canAssessScorecard }: { canAssessScorecard: boolean }) {
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <DashboardFilters projects={projectOptions?.projects ?? []} projectId={projectId} onProjectChange={setProjectId} />
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
          <p className="text-sm text-destructive">Failed to load the dashboard.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project health</CardTitle>
              <CardDescription>On Track / Attention / Critical, derived from dates, issues and labour cover.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.projects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {p.name} <span className="text-muted-foreground">({p.code})</span>
                      </span>
                      <ProjectHealthBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">At-risk projects</CardTitle>
              <CardDescription>Attention/Critical projects, worst first, with the reason.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.atRisk.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {data.projects.length === 0 ? "No projects yet." : "Nothing at risk — every project is On Track."}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.atRisk.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {p.name} <span className="font-normal text-muted-foreground">({p.code})</span>
                        </span>
                        <ProjectHealthBadge status={p.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{p.reasons.join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Critical dates — next 30 days</CardTitle>
              <CardDescription>Auto-derived from critical activities across every project.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.criticalDates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No critical dates in the next 30 days.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {data.criticalDates.slice(0, 10).map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {m.project.name} <span className="text-muted-foreground">({m.project.code})</span> — {m.name}
                      </span>
                      <span className="text-muted-foreground">{formatDate(m.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline snapshot</CardTitle>
              <CardDescription>Tender pipeline weighted by win probability.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Weighted pipeline</p>
                <p className="text-lg font-semibold text-foreground">{formatCurrency(data.pipeline.weightedPipeline)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total pipeline</p>
                <p className="text-lg font-semibold text-foreground">{formatCurrency(data.pipeline.totalPipeline)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active bids</p>
                <p className="text-lg font-semibold text-foreground">{data.pipeline.activeBids}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win rate (value)</p>
                <p className="text-lg font-semibold text-foreground">{formatPercent(data.pipeline.winRateValue)}</p>
              </div>
            </CardContent>
          </Card>

          <CapacityHeadroomCard headroom={data.capacity} />

          <AlertsPanel alerts={data.alerts} />
        </div>
      )}

      <StaffScorecardPanel canAssess={canAssessScorecard} />
    </div>
  );
}
