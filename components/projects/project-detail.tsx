"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import { ProjectFormSheet, type ProjectRow } from "./project-form-sheet";
import { ActivityFormSheet, type ActivityRow } from "./activity-form-sheet";
import { GanttView } from "./gantt-view";
import { CalendarView } from "./calendar-view";
import { LabourWeekGrid } from "./labour-week-grid";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { ProjectDocumentActions } from "@/components/documents/generated/project-document-actions";
import { TradePackagesCard } from "./trade-packages-card";
import { FinancialsTab } from "@/components/finance/financials-tab";
import { DeliveryRegister } from "@/components/finance/delivery-register";
import { SiteUpdatesPanel } from "@/components/site/site-updates-panel";
import { IssuesPanel } from "@/components/site/issues-panel";

type ApiProject = ProjectRow & {
  client: { id: string; name: string };
  pmUser: { id: string; name: string } | null;
  foremanUser: { id: string; name: string } | null;
  sourceTender: { id: string; projectName: string } | null;
  milestones: { id: string; name: string; date: string }[];
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Critical") return "destructive";
  if (status === "Attention") return "secondary";
  return "default";
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return (await res.json()) as { project: ApiProject };
    },
  });

  const { data: activitiesData } = useQuery({
    queryKey: ["projects", projectId, "activities"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/activities`);
      if (!res.ok) throw new Error("Failed to load activities");
      return (await res.json()) as { activities: ActivityRow[] };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading project...</p>;

  const project = data.project;
  const activities = activitiesData?.activities ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
            <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.code} &middot; {project.client.name}
            {project.address ? ` · ${project.address}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditSheetOpen(true)}>
          <Pencil className="size-4" />
          Edit project
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="program">Program</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="site-updates">Site updates</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Value</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold text-foreground">
                {formatCurrency(project.value)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Start</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold text-foreground">
                {formatDate(project.startDate)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">End</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold text-foreground">{formatDate(project.endDate)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Project manager</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold text-foreground">
                {project.pmUser?.name ?? "Unassigned"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Foreman</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold text-foreground">
                {project.foremanUser?.name ?? "Unassigned"}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Critical dates (next 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {project.milestones.filter((m) => new Date(m.date) >= new Date()).length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming critical dates.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {project.milestones
                    .filter((m) => new Date(m.date) >= new Date())
                    .slice(0, 8)
                    .map((m) => (
                      <li key={m.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{m.name}</span>
                        <span className="text-muted-foreground">{formatDate(m.date)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {project.sourceTender && (
            <p className="text-xs text-muted-foreground">
              Converted from tender &ldquo;{project.sourceTender.projectName}&rdquo;.
            </p>
          )}
        </TabsContent>

        <TabsContent value="program" className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditingActivity(null);
                setActivitySheetOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add activity
            </Button>
          </div>

          <GanttView
            activities={activities.map((a) => ({
              id: a.id,
              name: a.name,
              trade: a.trade,
              startDate: a.startDate,
              endDate: a.endDate,
              isCritical: a.isCritical,
              status: a.status,
            }))}
          />

          <CalendarView
            activities={activities.map((a) => ({
              id: a.id,
              name: a.name,
              trade: a.trade,
              startDate: a.startDate,
              endDate: a.endDate,
              isCritical: a.isCritical,
            }))}
            milestones={project.milestones}
          />

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Critical</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditingActivity(a);
                      setActivitySheetOpen(true);
                    }}
                  >
                    <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.trade}</TableCell>
                    <TableCell>{formatDate(a.startDate)}</TableCell>
                    <TableCell>{formatDate(a.endDate)}</TableCell>
                    <TableCell>{a.isCritical ? <Badge variant="destructive">Critical</Badge> : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.status}</TableCell>
                  </TableRow>
                ))}
                {activities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No program activities yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="labour">
          <LabourWeekGrid projectId={projectId} />
        </TabsContent>

        <TabsContent value="documents" className="flex flex-col gap-4">
          <TradePackagesCard projectId={projectId} />
          <ProjectDocumentActions projectId={projectId} />
          <DocumentsPanel target={{ projectId }} />
        </TabsContent>

        <TabsContent value="financials">
          <FinancialsTab projectId={projectId} canApprove />
        </TabsContent>

        <TabsContent value="deliveries">
          <DeliveryRegister projectId={projectId} />
        </TabsContent>

        <TabsContent value="site-updates">
          <SiteUpdatesPanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="issues">
          <IssuesPanel projectId={projectId} />
        </TabsContent>
      </Tabs>

      <ProjectFormSheet open={editSheetOpen} onOpenChange={setEditSheetOpen} project={project} />
      <ActivityFormSheet
        open={activitySheetOpen}
        onOpenChange={setActivitySheetOpen}
        projectId={projectId}
        activity={editingActivity}
      />
    </div>
  );
}
