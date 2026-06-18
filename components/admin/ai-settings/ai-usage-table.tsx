"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type UsageLog = {
  id: string;
  feature: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costEstimateUsd: number;
  latencyMs: number;
  success: boolean;
  error: string | null;
  createdAt: string;
  organisation?: { name: string } | null;
};

export function AiUsageTable({
  apiBase = "/api/admin/ai-usage",
  showOrgColumn = false,
}: {
  apiBase?: string;
  showOrgColumn?: boolean;
}) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: [apiBase, page],
    queryFn: async () => {
      const res = await fetch(`${apiBase}?page=${page}`);
      if (!res.ok) throw new Error("Failed to load AI usage");
      return (await res.json()) as { logs: UsageLog[]; total: number; page: number; pageSize: number };
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {showOrgColumn && <TableHead>Org</TableHead>}
              <TableHead>Feature</TableHead>
              <TableHead>Provider / Model</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={showOrgColumn ? 8 : 7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={showOrgColumn ? 8 : 7} className="text-center text-muted-foreground">
                  No AI usage recorded yet.
                </TableCell>
              </TableRow>
            )}
            {data?.logs.map((log) => (
              <TableRow key={log.id}>
                {showOrgColumn && <TableCell className="text-muted-foreground">{log.organisation?.name ?? "—"}</TableCell>}
                <TableCell className="font-medium text-foreground">{log.feature}</TableCell>
                <TableCell className="text-muted-foreground">
                  {log.provider} / {log.model}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.promptTokens + log.completionTokens}
                </TableCell>
                <TableCell className="text-muted-foreground">${log.costEstimateUsd.toFixed(4)}</TableCell>
                <TableCell className="text-muted-foreground">{log.latencyMs}ms</TableCell>
                <TableCell>
                  <Badge variant={log.success ? "outline" : "secondary"}>
                    {log.success ? "Success" : "Failed"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
