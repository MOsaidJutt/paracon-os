"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { ForecastMatrix } from "@/components/forecast/forecast-matrix";
import { ForecastHeatmap } from "@/components/forecast/forecast-heatmap";
import { roundHeadroom, roundShortfall } from "@/lib/forecast/format";
import type { HeatmapCell, MatrixCell } from "@/lib/forecast/engine";

type RoleHeadroom = { role: string; headroom: number };
type ShortageEntry = { role: string; blockIndex: number; blockLabel: string; gap: number };
type CapacityHeadroom = {
  byRole: RoleHeadroom[];
  shortages: ShortageEntry[];
  canTakeOnMoreWork: boolean;
  totalHeadroom: number;
};
type ForecastBreakdown = { roles: string[]; matrix: MatrixCell[]; heatmap: HeatmapCell[] };

function headroomLabel(headroom: number): string {
  const rounded = roundHeadroom(headroom);
  if (rounded > 0) return `+${rounded} spare`;
  if (rounded < 0) return `${rounded} short`;
  return "exactly covered";
}

export function CapacityHeadroomCard({ headroom }: { headroom: CapacityHeadroom }) {
  const [open, setOpen] = useState(false);
  const rolesWithSignal = headroom.byRole.filter((r) => roundHeadroom(r.headroom) !== 0);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["forecast", "matrix"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/forecast/matrix");
      if (!res.ok) throw new Error("Failed to load the forecast breakdown");
      return (await res.json()) as ForecastBreakdown;
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Can we take on more work?</CardTitle>
          <Badge variant={headroom.canTakeOnMoreWork ? "default" : "destructive"}>
            {headroom.canTakeOnMoreWork ? "Yes" : "Not without hiring"}
          </Badge>
        </div>
        <CardDescription>
          Worst-case spare capacity per trade across the whole forecast horizon — the amount of
          new work each trade could take on today without creating a future shortage.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rolesWithSignal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every trade is exactly covered — no spare capacity, no shortage.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rolesWithSignal.map((r) => (
              <Badge key={r.role} variant={r.headroom < 0 ? "destructive" : "outline"} className="gap-1">
                {r.role}
                <span className="font-normal opacity-80">· {headroomLabel(r.headroom)}</span>
              </Badge>
            ))}
          </div>
        )}

        {headroom.shortages.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Shortages by trade and block</p>
            <ul className="flex flex-col gap-1">
              {headroom.shortages.map((s, i) => (
                <li key={`${s.role}-${s.blockIndex}-${i}`} className="text-sm text-muted-foreground">
                  <span className="text-foreground">{s.role}</span> — short {roundShortfall(s.gap)} in {s.blockLabel}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 self-start text-sm font-medium text-brass hover:underline">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {open ? "Hide forecast breakdown" : "Show forecast breakdown"}
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4 pt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading forecast breakdown...</p>
            ) : isError || !data ? (
              <QueryErrorState message="Failed to load the forecast breakdown." onRetry={() => refetch()} isRetrying={isRefetching} />
            ) : (
              <>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-foreground">Demand vs supply by trade</p>
                  <ForecastMatrix roles={data.roles} matrix={data.matrix} />
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-foreground">Capacity heatmap — trade × week</p>
                  <ForecastHeatmap trades={data.roles} heatmap={data.heatmap} />
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
