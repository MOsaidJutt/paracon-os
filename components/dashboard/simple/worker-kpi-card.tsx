"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { DetailPanel } from "./detail-panel";
import type { BarDatum } from "@/lib/dashboard/simple-service";
import type { WorkerKpiBreakdown, WorkerKpiMetric } from "@/lib/dashboard/worker-kpi-service";

/** Bar label to the metric key its drill-down is fetched by. */
const METRIC_BY_LABEL: Record<string, WorkerKpiMetric> = {
  Attendance: "attendance",
  "Hours vs plan": "hours",
  "Compliance current": "compliance",
  "Scorecard average": "scorecard",
};

const EXPLANATION: Record<WorkerKpiMetric, string> = {
  attendance:
    "Days actually worked against days rostered, across every project this month. It comes from the foreman's daily update, so it only counts crews that were logged.",
  hours:
    "Hours planned against hours actually worked. 100% means the work came in on or under the hours planned for it. Planned hours exist per trade, not per person, so this one ranks trades.",
  compliance:
    "Worker compliance documents still valid, out of every document on file. Expiring and expired both count against it.",
  scorecard: "The average monthly staff score across everyone assessed for this period.",
};

/**
 * Band C, right: the worker KPI bars, each one tappable for the ranked list
 * behind it — worst first, because a ranked list on a dashboard exists to
 * surface who needs attention.
 *
 * The ranking is fetched on demand rather than shipped with the dashboard:
 * four ranked lists of every worker would dominate a payload whose whole job
 * is to render above the fold quickly.
 */
export function WorkerKpiCard({ bars }: { bars: BarDatum[] }) {
  const [active, setActive] = useState<{ label: string; metric: WorkerKpiMetric } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "worker-kpi", active?.metric],
    enabled: active !== null,
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/worker-kpi?metric=${active!.metric}`);
      if (!res.ok) throw new Error("Failed to load the breakdown");
      return (await res.json()) as WorkerKpiBreakdown;
    },
  });

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Worker KPIs</CardTitle>
          <CardDescription>This month, across every project. Tap one for who&apos;s behind it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bars.length === 0 ? (
            <EmptyState
              title="No worker data this month"
              description="These fill in from daily site updates and compliance records."
            />
          ) : (
            bars.map((bar) => {
              const metric = METRIC_BY_LABEL[bar.label];
              if (!metric) {
                return (
                  <ProgressBar
                    key={bar.label}
                    label={bar.label}
                    percent={bar.percent}
                    band={bar.band}
                    valueLabel={bar.valueLabel}
                  />
                );
              }
              return (
                <button
                  key={bar.label}
                  type="button"
                  onClick={() => setActive({ label: bar.label, metric })}
                  className="w-full rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ProgressBar
                    label={bar.label}
                    percent={bar.percent}
                    band={bar.band}
                    valueLabel={bar.valueLabel}
                  />
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <DetailPanel
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
        title={active?.label ?? ""}
        description={data?.byTrade ? "Ranked by trade, worst first" : "Ranked worst first"}
        footer={
          <Button asChild variant="outline" size="sm">
            <Link href={active?.metric === "scorecard" ? "/scorecard" : "/labour"}>Open the full view</Link>
          </Button>
        }
      >
        {active && (
          <div className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{EXPLANATION[active.metric]}</p>

            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : isError || !data ? (
              <p className="text-sm text-muted-foreground">Couldn&apos;t load the breakdown.</p>
            ) : data.rows.length === 0 ? (
              <EmptyState
                title="Nothing recorded yet"
                description="There's no data behind this figure for the current period."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {data.rows.map((row) => (
                  <li key={row.id}>
                    <ProgressBar
                      label={row.subtitle ? `${row.name} · ${row.subtitle}` : row.name}
                      percent={row.percent}
                      band={row.band}
                      valueLabel={row.detail}
                    />
                    {row.href && (
                      <Link
                        href={row.href}
                        className="mt-0.5 inline-block text-xs font-medium text-brass hover:underline"
                      >
                        Open {row.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DetailPanel>
    </>
  );
}
