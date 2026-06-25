"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductivityRecordRow = {
  id: string;
  trade: string;
  periodStart: string;
  plannedHours: number;
  actualHours: number;
  outputRatio: number | null;
  reliabilityPct: number | null;
  costPerHour: number | null;
  project: { id: string; name: string; code: string };
};

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

function formatPct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function ProductivityTrends() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["productivity", page],
    queryFn: async () => {
      const res = await fetch(`/api/productivity?page=${page}`);
      if (!res.ok) throw new Error("Failed to load productivity trends");
      return (await res.json()) as { records: ProductivityRecordRow[]; total: number; page: number; pageSize: number };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  if (isError || !data) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
        <p className="text-sm text-destructive">Failed to load productivity trends.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? "Retrying..." : "Retry"}
        </Button>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Productivity by trade</CardTitle>
        <CardDescription>
          Planned vs actual labour hours per project/month, with a $/hour benchmark proxied from each
          trade&apos;s share of the project&apos;s planned labour mix — not a literal $/m² rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No productivity history yet — recompute after a few daily updates have been submitted.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead className="text-right">Planned hrs</TableHead>
                  <TableHead className="text-right">Actual hrs</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Reliability</TableHead>
                  <TableHead className="text-right">$/hr (proxy)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatMonth(r.periodStart)}</TableCell>
                    <TableCell>
                      {r.project.name} <span className="text-muted-foreground">({r.project.code})</span>
                    </TableCell>
                    <TableCell>{r.trade}</TableCell>
                    <TableCell className="text-right">{r.plannedHours.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{r.actualHours.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{formatPct(r.outputRatio)}</TableCell>
                    <TableCell className="text-right">{formatPct(r.reliabilityPct)}</TableCell>
                    <TableCell className="text-right">{r.costPerHour ? `$${r.costPerHour.toFixed(0)}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {data.page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
