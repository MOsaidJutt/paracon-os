"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/tenders/format";

type ProjectFinancials = {
  contractValue: number;
  costBudget: number | null;
  committedCost: number;
  actualCost: number;
  claimedToDate: number;
  certifiedToDate: number;
  paidToDate: number;
  retentionHeldToDate: number;
  marginPlannedPct: number | null;
  marginToDatePct: number | null;
};

function StatCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "danger" }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className={`text-lg font-semibold ${tone === "danger" ? "text-rag-red" : "text-foreground"}`}>
        {value}
        {hint && <p className="mt-0.5 text-xs font-normal text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function FinancialsSummaryCards({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["finance", "financials", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/financials`);
      if (!res.ok) throw new Error("Failed to load financials");
      return (await res.json()) as { financials: ProjectFinancials };
    },
  });

  if (isLoading || !data) {
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-md bg-muted/40" />)}</div>;
  }

  const f = data.financials;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Contract value" value={formatCurrency(f.contractValue)} hint="incl. approved variations" />
      <StatCard label="Cost budget" value={f.costBudget != null ? formatCurrency(f.costBudget) : "Not set"} />
      <StatCard label="Committed (POs)" value={formatCurrency(f.committedCost)} />
      <StatCard label="Actual cost" value={formatCurrency(f.actualCost)} hint="approved bills onward" />
      <StatCard label="Claimed to date" value={formatCurrency(f.claimedToDate)} />
      <StatCard label="Paid to date" value={formatCurrency(f.paidToDate)} />
      <StatCard label="Retention held" value={formatCurrency(f.retentionHeldToDate)} />
      <StatCard
        label="Margin (planned / to date)"
        value={`${f.marginPlannedPct != null ? formatPercent(f.marginPlannedPct / 100) : "—"} / ${f.marginToDatePct != null ? formatPercent(f.marginToDatePct / 100) : "—"}`}
        tone={(f.marginPlannedPct != null && f.marginPlannedPct < 0) || (f.marginToDatePct != null && f.marginToDatePct < 0) ? "danger" : "default"}
      />
    </div>
  );
}
