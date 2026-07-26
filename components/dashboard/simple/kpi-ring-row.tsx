"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiRing } from "@/components/ui/kpi-ring";
import { DetailPanel } from "./detail-panel";
import type { KpiRingData } from "@/lib/dashboard/simple-service";

const DETAIL_HREF: Record<string, string> = {
  "revenue-won": "/tenders",
  "win-rate-value": "/tenders",
  "win-rate-count": "/tenders",
  "submission-rate": "/tenders",
  "labour-utilisation": "/forecast",
  "projects-on-track": "/projects",
  "compliance-current": "/labour",
};

/**
 * Rings measured against an admin-set target, rather than against their own
 * total. Only these get the "Change target" action, because only these have
 * one — a win rate has no target to edit, it's a ratio of what happened.
 */
const TARGET_BACKED: string[] = ["revenue-won"];

/**
 * Band A: the north-star row. Four rings, each one a button that opens its own
 * explanation rather than navigating — the whole point of this dashboard is
 * that you can interrogate a number without leaving the page you came for.
 */
export function KpiRingRow({ rings, canEditSettings }: { rings: KpiRingData[]; canEditSettings: boolean }) {
  const [active, setActive] = useState<KpiRingData | null>(null);

  return (
    <>
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:gap-6 lg:grid-cols-4">
          {rings.map((ring) => (
            <button
              key={ring.id}
              type="button"
              onClick={() => setActive(ring)}
              aria-label={`${ring.title}, open detail`}
              className="flex flex-col items-center rounded-lg p-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <KpiRing percent={ring.percent} band={ring.band} label={ring.title} sublabel={ring.detail} />
            </button>
          ))}
        </CardContent>
      </Card>

      <DetailPanel
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
        title={active?.title ?? ""}
        description={active?.detail}
        footer={
          active && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={DETAIL_HREF[active.id] ?? "/dashboard"}>Open the full view</Link>
              </Button>
              {canEditSettings && TARGET_BACKED.includes(active.id) && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/settings">Change the target</Link>
                </Button>
              )}
            </div>
          )
        }
      >
        {active && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-5">
              <KpiRing percent={active.percent} band={active.band} label={active.title} size={132} />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Right now</p>
                <p className="font-heading text-2xl font-semibold text-foreground">{active.detail}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-1.5 text-sm font-medium text-foreground">How this is worked out</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{active.explanation}</p>
            </div>

            {active.percent === null && (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Nothing has been recorded for this yet, so there is no percentage to show. It will fill in on its
                own once the underlying records exist.
              </p>
            )}
          </div>
        )}
      </DetailPanel>
    </>
  );
}
