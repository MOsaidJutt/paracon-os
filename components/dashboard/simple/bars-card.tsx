"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/shared/empty-state";
import type { BarDatum } from "@/lib/dashboard/simple-service";

/**
 * A card of labelled progress bars. Both Band C bar widgets (worker KPIs and
 * the per-trade scorecard) are the same shape, so they're the same component —
 * two near-identical cards drifting apart is exactly the inconsistency the
 * simplified view is meant to remove.
 */
export function BarsCard({
  title,
  description,
  bars,
  emptyTitle,
  emptyDescription,
  footer,
}: {
  title: string;
  description: string;
  bars: BarDatum[];
  emptyTitle: string;
  emptyDescription: string;
  footer?: ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {bars.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          bars.map((bar) => (
            <ProgressBar
              key={bar.label}
              label={bar.label}
              percent={bar.percent}
              band={bar.band}
              valueLabel={bar.valueLabel}
            />
          ))
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
