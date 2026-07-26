"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/tenders/format";
import { EmptyState } from "@/components/shared/empty-state";
import type { SimpleDashboard } from "@/lib/dashboard/simple-service";

/**
 * The two widgets that are off by default: the raw pipeline figures and the
 * critical-date list. Both are already summarised by a ring or an alert, so
 * they're here for the user who wants the underlying numbers on the page
 * rather than one tap away.
 */
export function PipelineFiguresCard({ pipeline }: { pipeline: NonNullable<SimpleDashboard["pipeline"]> }) {
  const figures = [
    { label: "Revenue won", value: formatCurrency(pipeline.revenueWon) },
    { label: "Weighted pipeline", value: formatCurrency(pipeline.weightedPipeline) },
    { label: "Total pipeline", value: formatCurrency(pipeline.totalPipeline) },
    { label: "Active bids", value: String(pipeline.activeBids) },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Pipeline figures</CardTitle>
        <CardDescription>The raw numbers behind the tender rings.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {figures.map((figure) => (
          <div key={figure.label}>
            <p className="text-xs text-muted-foreground">{figure.label}</p>
            <p className="font-heading text-lg font-semibold tabular-nums text-foreground">{figure.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CriticalDatesCard({ criticalDates }: { criticalDates: SimpleDashboard["criticalDates"] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Critical dates</CardTitle>
        <CardDescription>Every critical activity due in the next 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {criticalDates.length === 0 ? (
          <EmptyState title="Nothing due" description="No critical dates fall in the next 30 days." />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {criticalDates.slice(0, 8).map((date) => (
              <li key={date.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {date.project.name} <span className="text-muted-foreground">— {date.name}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">{formatDate(date.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
