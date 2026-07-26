"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { roundHeadroom } from "@/lib/forecast/format";
import { DetailPanel } from "./detail-panel";
import type { RagBand } from "@/lib/dashboard/rag";
import type { TradeUtilisation } from "@/lib/dashboard/simple-metrics";
import type { SimpleDashboard } from "@/lib/dashboard/simple-service";

type Capacity = NonNullable<SimpleDashboard["capacity"]>;

/**
 * Band B, right: how committed each trade already is, and the plain answer to
 * "can we take on more work?".
 *
 * The bar length is utilisation, but its colour is HEADROOM, not utilisation —
 * a trade at 95% with a spare body is fine, and a trade at 60% that's already
 * short in a later block is not. Colouring by busy-ness would have made the
 * calmest-looking bar the one that needs hiring.
 */
function bandForHeadroom(headroom: number): RagBand {
  const rounded = roundHeadroom(headroom);
  if (rounded < 0) return "bad";
  if (rounded === 0) return "warning";
  return "good";
}

function headroomLabel(headroom: number): string {
  const rounded = roundHeadroom(headroom);
  if (rounded > 0) return `${rounded} spare`;
  if (rounded < 0) return `${Math.abs(rounded)} short`;
  return "fully committed";
}

export function CapacityCard({ capacity }: { capacity: Capacity }) {
  const [active, setActive] = useState<TradeUtilisation | null>(null);
  const trades = capacity.trades.filter((trade) => trade.supply > 0 || trade.demand > 0);

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Can we take on more work?</CardTitle>
            <CardDescription>How committed each trade already is. Tap a trade for the weeks behind it.</CardDescription>
          </div>
          <Badge variant={capacity.canTakeOnMoreWork ? "success" : "destructive"} className="shrink-0">
            {capacity.canTakeOnMoreWork ? "Yes" : "Not without hiring"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {trades.length === 0 ? (
            <EmptyState
              title="No forecast yet"
              description="Capacity appears once projects carry labour requirements and workers are on the books."
            />
          ) : (
            trades.map((trade) => (
              <button
                key={trade.role}
                type="button"
                onClick={() => setActive(trade)}
                className="w-full rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ProgressBar
                  label={trade.role}
                  percent={trade.utilisationPercent}
                  band={bandForHeadroom(trade.headroom)}
                  valueLabel={`${Math.round(trade.utilisationPercent)}% · ${headroomLabel(trade.headroom)}`}
                />
              </button>
            ))
          )}

          {capacity.shortages.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {capacity.shortages.length} shortage{capacity.shortages.length > 1 ? "s" : ""} ahead in the forecast
              horizon.
            </p>
          )}
        </CardContent>
      </Card>

      <DetailPanel
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
        title={active ? `${active.role} capacity` : ""}
        description={active ? headroomLabel(active.headroom) : undefined}
        footer={
          <Button asChild variant="outline" size="sm">
            <Link href="/allocation">Open the resource planner</Link>
          </Button>
        }
      >
        {active && (
          <div className="flex flex-col gap-5">
            <ProgressBar
              label="Committed this block"
              percent={active.utilisationPercent}
              band={bandForHeadroom(active.headroom)}
            />

            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Committed (worker-weeks)</dt>
                <dd className="tabular-nums text-foreground">{active.demand.toFixed(1)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Available (worker-weeks)</dt>
                <dd className="tabular-nums text-foreground">{active.supply.toFixed(1)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Worst-case spare across the horizon</dt>
                <dd className="tabular-nums text-foreground">{roundHeadroom(active.headroom)}</dd>
              </div>
            </dl>

            {capacity.shortages.filter((s) => s.role === active.role).length > 0 && (
              <section>
                <h3 className="mb-1.5 text-sm font-medium text-foreground">Where it runs short</h3>
                <ul className="flex flex-col gap-1">
                  {capacity.shortages
                    .filter((s) => s.role === active.role)
                    .map((shortage, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        · {shortage.blockLabel} — short {Math.round(shortage.gap)}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            <p className="text-sm leading-relaxed text-muted-foreground">
              Spare capacity is the worst week across the whole forecast horizon, not the average. It answers how
              much new work this trade could absorb today without creating a shortage later.
            </p>
          </div>
        )}
      </DetailPanel>
    </>
  );
}
