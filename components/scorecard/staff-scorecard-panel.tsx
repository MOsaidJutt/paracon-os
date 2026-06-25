"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScoreGauge, bandForScore } from "@/components/scorecard/score-gauge";
import { ScorecardAssessSheet } from "@/components/scorecard/scorecard-assess-sheet";

type ScorecardRow = {
  worker: { id: string; name: string; capability: string; photoUrl: string | null };
  score: { id: string; overallScore: number; lockedAt: string | null } | null;
};
type GaugeThresholds = { goodThreshold: number; warningThreshold: number };
type MetricConfig = { key: string; label: string; weight: number; scaleMax: number; source: "AUTO" | "MANUAL" };
type WorkerDetail = {
  metrics: MetricConfig[];
  score: { metricScoresJson: Record<string, number> };
  history: { period: string; overallScore: number }[];
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const width = 220;
  const height = 36;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="text-brass">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StaffScorecardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-border p-4">
          <Skeleton className="size-[104px] rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

function StaffScorecardCard({
  row,
  period,
  thresholds,
  onSelect,
}: {
  row: ScorecardRow;
  period: string;
  thresholds: GaugeThresholds;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["scorecard", "worker", row.worker.id, period],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/scorecard/${row.worker.id}?period=${period}`);
      if (!res.ok) throw new Error("Failed to load scorecard detail");
      return (await res.json()) as WorkerDetail;
    },
  });

  const score = row.score?.overallScore ?? 0;
  const band = bandForScore(score, thresholds.goodThreshold, thresholds.warningThreshold);

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={row.worker.name}
          onClick={onSelect}
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-colors hover:bg-muted/60"
        >
          <ScoreGauge value={score} band={row.score ? band : "warning"} size={104} />
          <div>
            <p className="text-sm font-medium text-foreground">{row.worker.name}</p>
            <p className="text-xs text-muted-foreground">{row.worker.capability}</p>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        {!row.score ? (
          <p className="text-sm text-muted-foreground">Not assessed for {period} yet.</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">{row.worker.name} — metric breakdown</p>
            <ul className="flex flex-col gap-1">
              {data.metrics.map((m) => (
                <li key={m.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="text-foreground">
                    {(data.score.metricScoresJson[m.key] ?? 0).toFixed(1)} / {m.scaleMax}
                  </span>
                </li>
              ))}
            </ul>
            {data.history.length > 1 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Trend (overall score)</p>
                <Sparkline values={data.history.map((h) => h.overallScore)} />
              </div>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export function StaffScorecardPanel({ canAssess }: { canAssess: boolean }) {
  const [period] = useState(() => new Date().toISOString().slice(0, 7));
  const [activeWorker, setActiveWorker] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["scorecard", period],
    queryFn: async () => {
      const res = await fetch(`/api/scorecard?period=${period}`);
      if (!res.ok) throw new Error("Failed to load scorecards");
      return (await res.json()) as { period: string; rows: ScorecardRow[]; gaugeThresholds: GaugeThresholds };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Staff Scorecard</CardTitle>
        <CardDescription>
          Monthly performance for key staff, visible to everyone. Hover a gauge for the metric breakdown and trend.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <StaffScorecardGridSkeleton />
        ) : isError || !data ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-destructive">Failed to load scorecards.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? "Retrying..." : "Retry"}
            </Button>
          </div>
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No key staff flagged yet — mark a worker as &quot;Key staff&quot; from their profile to include them here.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.rows.map((row) => (
              <StaffScorecardCard
                key={row.worker.id}
                row={row}
                period={data.period}
                thresholds={data.gaugeThresholds}
                onSelect={() => setActiveWorker({ id: row.worker.id, name: row.worker.name })}
              />
            ))}
          </div>
        )}
      </CardContent>

      {activeWorker && data && (
        <ScorecardAssessSheet
          open
          onOpenChange={(open) => !open && setActiveWorker(null)}
          workerId={activeWorker.id}
          workerName={activeWorker.name}
          period={data.period}
          canAssess={canAssess}
        />
      )}
    </Card>
  );
}
