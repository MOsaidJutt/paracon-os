"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHealthBadge } from "@/components/dashboard/project-health-badge";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <DashboardFilters projects={projectOptions} projectId={projectId} onProjectChange={setProjectId} />
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
      ) : data.projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects assigned to you yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">My projects</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data.projects.map((p) => (
                <Badge key={p.id} variant="outline" className="gap-1.5">
                  {p.name}
                  <ProjectHealthBadge status={p.status} />
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3-week look-ahead</CardTitle>
              <CardDescription>Upcoming activities across your projects.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.lookahead.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities in the next 3 weeks.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {data.lookahead.map((a) => (
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery status</CardTitle>
            </CardHeader>
            <CardContent>
              {data.deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliveries tracked yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.deliveries.map((d) => (
                    <Badge key={d.status} variant="outline">
                      {d.status}: {d.count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open issues</CardTitle>
            </CardHeader>
            <CardContent>
              {data.openIssues.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open issues.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.openIssues.map((issue) => (
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

          <AlertsPanel alerts={data.alerts} />
        </div>
      )}

      <StaffScorecardPanel canAssess={canAssessScorecard} />
    </div>
  );
}
