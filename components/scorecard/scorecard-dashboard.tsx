"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScorecardAssessSheet } from "./scorecard-assess-sheet";

type ScorecardRow = {
  worker: { id: string; name: string; capability: string; photoUrl: string | null };
  score: { id: string; overallScore: number; lockedAt: string | null } | null;
};

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function ScorecardDashboard({ canAssess }: { canAssess: boolean }) {
  const [period, setPeriod] = useState(currentMonthKey());
  const [activeWorker, setActiveWorker] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["scorecard", period],
    queryFn: async () => {
      const res = await fetch(`/api/scorecard?period=${period}`);
      if (!res.ok) throw new Error("Failed to load scorecards");
      return (await res.json()) as { period: string; rows: ScorecardRow[] };
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scorecard-month">Month</Label>
          <Input
            id="scorecard-month"
            type="month"
            value={period}
            max={currentMonthKey()}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : isError || !data ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-destructive">Failed to load scorecards.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                {isRefetching ? "Retrying..." : "Retry"}
              </Button>
            </div>
          ) : data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No key staff flagged yet — mark a worker as &quot;Key staff&quot; from their profile to include
              them here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Capability</TableHead>
                  <TableHead className="text-right">Overall score</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow
                    key={row.worker.id}
                    className="cursor-pointer"
                    onClick={() => setActiveWorker({ id: row.worker.id, name: row.worker.name })}
                  >
                    <TableCell className="font-medium text-foreground">{row.worker.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.worker.capability}</TableCell>
                    <TableCell className="text-right">
                      {row.score ? row.score.overallScore.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="w-20 text-right">
                      {row.score?.lockedAt ? (
                        <Badge variant="outline">
                          <Lock className="mr-1 size-3" />
                          Locked
                        </Badge>
                      ) : (
                        <Button variant="ghost" size="sm">
                          {row.score ? "Edit" : "Assess"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {activeWorker && (
        <ScorecardAssessSheet
          open
          onOpenChange={(open) => !open && setActiveWorker(null)}
          workerId={activeWorker.id}
          workerName={activeWorker.name}
          period={period}
          canAssess={canAssess}
        />
      )}
    </div>
  );
}
