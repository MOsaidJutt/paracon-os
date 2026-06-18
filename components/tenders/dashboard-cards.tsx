"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/tenders/format";

type DashboardData = {
  summary: {
    weightedPipeline: number;
    totalPipeline: number;
    activeBids: number;
    winRateCount: number;
    winRateValue: number;
    submissionRate: number;
    revenueWon: number;
    avgBidValue: number;
  };
  bidSizeBands: {
    label: string;
    totalBids: number;
    wins: number;
    winRateCount: number;
    winRateValue: number;
    revenueWon: number;
    avgBidValue: number;
    pipelineValue: number;
  }[];
  timing: {
    avgDurationDays: number | null;
    lateSubmissionRate: number;
    rushTenderRate: number;
    onTimeSubmissionRate: number;
    dueThisWeek: number;
    overdue: number;
  };
  clientScorecard: {
    clientId: string;
    clientName: string;
    bidCount: number;
    wins: number;
    winRate: number;
    avgJobValue: number;
    totalWonValue: number;
    pipelineValue: number;
    score: number;
  }[];
};

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardCards() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenders", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/tenders/dashboard");
      if (!res.ok) throw new Error("Failed to load tender dashboard");
      return (await res.json()) as DashboardData;
    },
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading dashboard...</p>;
  }

  const { summary, bidSizeBands, timing, clientScorecard } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Weighted Pipeline" value={formatCurrency(summary.weightedPipeline)} />
        <KpiCard label="Total Pipeline" value={formatCurrency(summary.totalPipeline)} />
        <KpiCard label="Active Bids" value={String(summary.activeBids)} />
        <KpiCard label="Win Rate (Count)" value={formatPercent(summary.winRateCount)} />
        <KpiCard label="Win Rate (Value)" value={formatPercent(summary.winRateValue)} />
        <KpiCard label="Submission Rate" value={formatPercent(summary.submissionRate)} />
        <KpiCard label="Revenue Won" value={formatCurrency(summary.revenueWon)} />
        <KpiCard label="Avg Bid Value" value={formatCurrency(summary.avgBidValue)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bid-Size Intelligence</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Value Band</TableHead>
                <TableHead>Total Bids</TableHead>
                <TableHead>Wins</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead>Revenue Won</TableHead>
                <TableHead>Avg Bid Value</TableHead>
                <TableHead>Pipeline $</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bidSizeBands.map((band) => (
                <TableRow key={band.label}>
                  <TableCell className="font-medium text-foreground">{band.label}</TableCell>
                  <TableCell>{band.totalBids}</TableCell>
                  <TableCell>{band.wins}</TableCell>
                  <TableCell>{formatPercent(band.winRateCount)}</TableCell>
                  <TableCell>{formatCurrency(band.revenueWon)}</TableCell>
                  <TableCell>{formatCurrency(band.avgBidValue)}</TableCell>
                  <TableCell>{formatCurrency(band.pipelineValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tender Timing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          <div>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
            <p className="text-lg font-semibold text-foreground">
              {timing.avgDurationDays === null ? "—" : `${timing.avgDurationDays.toFixed(1)} days`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Late Submission</p>
            <p className="text-lg font-semibold text-foreground">{formatPercent(timing.lateSubmissionRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rush (&lt;3 Days)</p>
            <p className="text-lg font-semibold text-foreground">{formatPercent(timing.rushTenderRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On-Time</p>
            <p className="text-lg font-semibold text-foreground">{formatPercent(timing.onTimeSubmissionRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due This Week</p>
            <p className="text-lg font-semibold text-foreground">{timing.dueThisWeek}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className={`text-lg font-semibold ${timing.overdue > 0 ? "text-destructive" : "text-foreground"}`}>
              {timing.overdue}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Scorecard</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Bids</TableHead>
                <TableHead>Wins</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead>Avg Job Value</TableHead>
                <TableHead>Total Won $</TableHead>
                <TableHead>Pipeline $</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientScorecard.map((row) => (
                <TableRow key={row.clientId}>
                  <TableCell className="font-medium text-foreground">{row.clientName}</TableCell>
                  <TableCell>{row.bidCount}</TableCell>
                  <TableCell>{row.wins}</TableCell>
                  <TableCell>{formatPercent(row.winRate)}</TableCell>
                  <TableCell>{formatCurrency(row.avgJobValue)}</TableCell>
                  <TableCell>{formatCurrency(row.totalWonValue)}</TableCell>
                  <TableCell>{formatCurrency(row.pipelineValue)}</TableCell>
                  <TableCell>{formatCurrency(row.score)}</TableCell>
                </TableRow>
              ))}
              {clientScorecard.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No tenders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
