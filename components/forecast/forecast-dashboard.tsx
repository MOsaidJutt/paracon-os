"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ForecastMatrix } from "@/components/forecast/forecast-matrix";
import { ForecastHeatmap } from "@/components/forecast/forecast-heatmap";
import { CapacityHeadroomCard } from "@/components/forecast/capacity-headroom";
import { RecomputeForecastButton } from "@/components/forecast/recompute-forecast-button";
import { formatDate } from "@/lib/tenders/format";
import type { CapacityHeadroom, HeatmapCell, MatrixCell } from "@/lib/forecast/engine";

type ForecastResponse = {
  generatedAt: string;
  blockLengthDays: number;
  weeksOut: number;
  roles: string[];
  matrix: MatrixCell[];
  heatmap: HeatmapCell[];
  headroom: CapacityHeadroom;
};

export function ForecastDashboard() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["forecast", "matrix"],
    queryFn: async () => {
      const res = await fetch("/api/forecast/matrix");
      if (!res.ok) throw new Error("Failed to load forecast");
      return (await res.json()) as ForecastResponse;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading forecast...</p>;
  if (isError || !data) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
        <p className="text-sm text-destructive">Failed to load the forecast.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? "Retrying..." : "Retry"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Last recomputed {formatDate(data.generatedAt)}</p>
        <RecomputeForecastButton />
      </div>

      <CapacityHeadroomCard headroom={data.headroom} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forecast matrix — demand vs supply by trade</CardTitle>
          <CardDescription>
            {data.weeksOut} weeks out, in {Math.round(data.blockLengthDays / 7)}-week blocks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForecastMatrix roles={data.roles} matrix={data.matrix} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capacity heatmap — trade x week</CardTitle>
          <CardDescription>Shortfall shown as a negative number; covered weeks show demand.</CardDescription>
        </CardHeader>
        <CardContent>
          <ForecastHeatmap trades={data.roles} heatmap={data.heatmap} />
        </CardContent>
      </Card>
    </div>
  );
}
