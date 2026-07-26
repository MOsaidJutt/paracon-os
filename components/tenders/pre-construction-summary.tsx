"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiRing } from "@/components/ui/kpi-ring";
import { ProgressBar } from "@/components/ui/progress-bar";
import { bandForPercent } from "@/lib/dashboard/rag";
import { formatCurrency } from "@/lib/tenders/format";

// Same thresholds the simplified dashboard's percentage KPIs use — see the
// note in prospects-summary.tsx for why these are constants rather than a
// config round-trip for a glance strip.
const GOOD = 80;
const WARNING = 50;

type DashboardData = {
  summary: {
    weightedPipeline: number;
    totalPipeline: number;
    activeBids: number;
    winRateValue: number;
    submissionRate: number;
  };
  timing: {
    onTimeSubmissionRate: number;
    dueThisWeek: number;
    overdue: number;
  };
};

/**
 * The band above the register: the same bid-intelligence numbers the Intel tab
 * shows in full, condensed to a glance. Reads the existing
 * /api/tenders/dashboard endpoint — no new calculation, just the two figures
 * (win rate, submission/on-time rate) worth seeing before opening Intel.
 */
export function PreConstructionSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenders", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/tenders/dashboard");
      if (!res.ok) throw new Error("Failed to load tender dashboard");
      return (await res.json()) as DashboardData;
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-32 w-full" />;
  }

  const winRatePercent = data.summary.winRateValue * 100;
  const submissionPercent = data.summary.submissionRate * 100;
  const onTimePercent = data.timing.onTimeSubmissionRate * 100;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="shrink-0 self-center">
          <KpiRing
            percent={winRatePercent}
            band={bandForPercent(winRatePercent, GOOD, WARNING)}
            label="Win rate"
            sublabel="by value"
            size={104}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <Figure label="Weighted pipeline" value={formatCurrency(data.summary.weightedPipeline)} />
            <Figure label="Total pipeline" value={formatCurrency(data.summary.totalPipeline)} />
            <Figure label="Active bids" value={String(data.summary.activeBids)} />
          </div>

          <div className="flex flex-col gap-2">
            <ProgressBar
              label="Submission rate"
              percent={submissionPercent}
              band={bandForPercent(submissionPercent, GOOD, WARNING)}
            />
            <ProgressBar
              label="On-time"
              percent={onTimePercent}
              band={bandForPercent(onTimePercent, GOOD, WARNING)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Due this week: <span className="font-medium text-foreground">{data.timing.dueThisWeek}</span>
            {data.timing.overdue > 0 && (
              <>
                {" "}
                · Overdue: <span className="font-medium text-rag-red">{data.timing.overdue}</span>
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
