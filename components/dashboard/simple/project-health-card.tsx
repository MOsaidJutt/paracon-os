"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHealthBadge } from "@/components/dashboard/project-health-badge";
import { AuditTrail } from "@/components/audit/audit-trail";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import { DetailPanel } from "./detail-panel";
import type { ProjectHealthRow } from "@/lib/dashboard/director-service";

const COLLAPSED_ROWS = 5;

type ProjectDetail = {
  project: {
    id: string;
    name: string;
    code: string;
    status: string;
    value: number;
    address: string | null;
    startDate: string;
    endDate: string;
    client: { id: string; name: string } | null;
    pmUser: { id: string; name: string } | null;
    foremanUser: { id: string; name: string } | null;
    milestones: { id: string; name: string; date: string }[];
  };
};

/**
 * Band B, left: every project with its RAG health, worst first. The row itself
 * is the affordance — one tap opens the project beside the dashboard, with the
 * reasons behind its status, the dates coming up and its inline activity trail.
 */
export function ProjectHealthCard({ projects }: { projects: ProjectHealthRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState<ProjectHealthRow | null>(null);

  const ordered = [...projects].sort((a, b) => RISK_ORDER[a.status] - RISK_ORDER[b.status]);
  const visible = showAll ? ordered : ordered.slice(0, COLLAPSED_ROWS);
  const onTrackCount = projects.filter((p) => p.status === "On Track").length;

  const { data, isLoading } = useQuery({
    queryKey: ["project", active?.id],
    enabled: active !== null,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${active!.id}`);
      if (!res.ok) throw new Error("Failed to load the project");
      return (await res.json()) as ProjectDetail;
    },
  });

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Project health</CardTitle>
            <CardDescription>Worst first. Tap a project for the reasons behind its status.</CardDescription>
          </div>
          {projects.length > 0 && (
            <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground">
              {onTrackCount}/{projects.length} on track
            </span>
          )}
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Projects appear here as soon as a won tender is converted."
            />
          ) : (
            <>
              <ul className="flex flex-col">
                {visible.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => setActive(project)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {project.name} <span className="text-muted-foreground">({project.code})</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <ProjectHealthBadge status={project.status} />
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {ordered.length > COLLAPSED_ROWS && (
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? "Show fewer" : `Show ${ordered.length - COLLAPSED_ROWS} more`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <DetailPanel
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
        title={active?.name ?? ""}
        description={active ? `${active.code} · ${active.status}` : undefined}
        footer={
          active && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/projects/${active.id}`}>Open project</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/schedule?projectId=${active.id}`}>View programme</Link>
              </Button>
            </div>
          )
        }
      >
        {active && (
          <div className="flex flex-col gap-5">
            <section>
              <h3 className="mb-1.5 text-sm font-medium text-foreground">Why it reads {active.status}</h3>
              {active.reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No overdue dates, no open issues, no labour shortfall. Nothing to action.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {active.reasons.map((reason, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      · {reason}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-sm font-medium text-foreground">Details</h3>
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-5 w-3/5" />
                </div>
              ) : !data ? (
                <p className="text-sm text-muted-foreground">Couldn&apos;t load the project details.</p>
              ) : (
                <dl className="flex flex-col gap-1.5 text-sm">
                  <Row label="Client" value={data.project.client?.name ?? "Not set"} />
                  <Row label="Project manager" value={data.project.pmUser?.name ?? "Not assigned"} />
                  <Row label="Site manager" value={data.project.foremanUser?.name ?? "Not assigned"} />
                  <Row label="Address" value={data.project.address ?? "Not set"} />
                  <Row label="Value" value={formatCurrency(data.project.value)} />
                  <Row
                    label="Dates"
                    value={`${formatDate(data.project.startDate)} to ${formatDate(data.project.endDate)}`}
                  />
                </dl>
              )}
            </section>

            {data && data.project.milestones.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-sm font-medium text-foreground">Critical dates</h3>
                <ul className="flex flex-col gap-1">
                  {data.project.milestones.slice(0, 5).map((milestone) => (
                    <li key={milestone.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-foreground">{milestone.name}</span>
                      <span className="shrink-0 text-muted-foreground">{formatDate(milestone.date)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <AuditTrail entityType="Project" entityId={active.id} />
          </div>
        )}
      </DetailPanel>
    </>
  );
}

const RISK_ORDER: Record<ProjectHealthRow["status"], number> = { Critical: 0, Attention: 1, "On Track": 2 };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-foreground">{value}</dd>
    </div>
  );
}
