"use client";

import { Card, CardContent } from "@/components/ui/card";
import { KpiRing } from "@/components/ui/kpi-ring";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency } from "@/lib/tenders/format";
import { bandForPercent } from "@/lib/dashboard/rag";
import { summariseProspects } from "@/lib/prospects/summary";
import type { ProspectRow } from "./types";

// Same thresholds the simplified dashboard uses for percentage KPIs. Hard-coded
// here rather than fetched: this strip is a glance, and a config round-trip to
// colour one ring would cost more than it's worth. If the dashboard's own
// thresholds ever move off config-driven defaults, read them here too.
const GOOD = 80;
const WARNING = 50;

/**
 * The band above the board: how much of the pipeline has converted, and how
 * the open leads are spread across the stages.
 *
 * Deliberately the same ring and bar components as the dashboard, so the two
 * modules read as one product rather than two designs that happen to share a
 * codebase.
 */
export function ProspectsSummary({ prospects, stageList }: { prospects: ProspectRow[]; stageList: string[] }) {
  const summary = summariseProspects(prospects, stageList);
  const maxStageCount = Math.max(1, ...summary.byStage.map((s) => s.count));

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="shrink-0 self-center">
          <KpiRing
            percent={summary.conversionPercent}
            band={
              summary.conversionPercent === null
                ? "warning"
                : bandForPercent(summary.conversionPercent, GOOD, WARNING)
            }
            label="Converted"
            sublabel={`${summary.converted} of ${summary.total}`}
            size={104}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div>
              <p className="text-xs text-muted-foreground">Open pipeline</p>
              <p className="font-heading text-lg font-semibold tabular-nums text-foreground">
                {formatCurrency(summary.openValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Weighted by probability</p>
              <p className="font-heading text-lg font-semibold tabular-nums text-foreground">
                {formatCurrency(summary.weightedValue)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {summary.byStage.map((stage) => (
              <ProgressBar
                key={stage.stage}
                label={stage.stage}
                // Bars compare stages against each other, so the busiest stage
                // fills the track. A percentage of the total would leave every
                // bar short and say nothing useful.
                percent={(stage.count / maxStageCount) * 100}
                band="good"
                valueLabel={`${stage.count} ${stage.count === 1 ? "lead" : "leads"} · ${formatCurrency(stage.value)}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
