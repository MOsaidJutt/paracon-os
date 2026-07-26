"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { DetailPanel } from "./detail-panel";
import type { Alert } from "@/lib/dashboard/alerts";

const COLLAPSED_ROWS = 4;

/** What the alert's action button should say and where it goes — the shortage/compliance split the alert derivation already makes. */
const ACTION: Record<Alert["type"], { label: string }> = {
  shortage: { label: "Open the resource planner" },
  compliance: { label: "Open the worker record" },
};

/**
 * Band C, left: what needs attention today, red before amber. Each alert opens
 * beside the page with the one action that resolves it, rather than dropping
 * the user on a list page to find the record themselves.
 */
export function AlertsCard({ alerts }: { alerts: Alert[] }) {
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState<Alert | null>(null);
  const visible = showAll ? alerts : alerts.slice(0, COLLAPSED_ROWS);
  const redCount = alerts.filter((a) => a.severity === "red").length;

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Alerts</CardTitle>
            <CardDescription>Labour shortages and expiring compliance.</CardDescription>
          </div>
          {alerts.length > 0 && (
            <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
              {redCount > 0 ? `${redCount} urgent` : `${alerts.length}`}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <EmptyState title="Nothing needs attention" description="No labour shortages and no compliance expiring." />
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {visible.map((alert) => (
                  <li key={alert.id}>
                    <button
                      type="button"
                      onClick={() => setActive(alert)}
                      className="flex min-h-12 w-full items-start gap-2.5 rounded-md border border-border p-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {alert.severity === "red" ? (
                        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rag-red" aria-label="Urgent" />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rag-amber" aria-label="Warning" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">{alert.title}</span>
                        <span className="block text-muted-foreground">{alert.detail}</span>
                      </span>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
              {alerts.length > COLLAPSED_ROWS && (
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? "Show fewer" : `Show ${alerts.length - COLLAPSED_ROWS} more`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <DetailPanel
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
        title={active?.title ?? ""}
        description={active?.detail}
        footer={
          active && (
            <Button asChild size="sm">
              <Link href={active.href}>{ACTION[active.type].label}</Link>
            </Button>
          )
        }
      >
        {active && (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {active.type === "shortage"
                ? "This trade has more work committed than people available. Allocating a worker, moving a task, or subcontracting the gap all clear it."
                : "This worker's document has expired or is about to. Recording a new expiry date on their compliance record clears it."}
            </p>
            <p className="text-sm text-muted-foreground">
              {active.severity === "red"
                ? "Marked urgent because it affects the current week."
                : "Marked as a warning because it lands later in the watch window, not this week."}
            </p>
          </div>
        )}
      </DetailPanel>
    </>
  );
}
