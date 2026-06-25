"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/tenders/format";

type SiteUpdateRow = {
  date: string;
  foremanUser: { name: string };
  issues: { id: string; description: string; severity: string; status: string; createdAt: string }[];
};

function severityVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  if (severity === "High") return "destructive";
  if (severity === "Medium") return "secondary";
  return "outline";
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Resolved") return "default";
  if (status === "In Progress") return "secondary";
  return "outline";
}

/** Flattens issues out of the daily-update feed — issues are raised from the mobile flow, so there's no separate creation endpoint yet. */
export function IssuesPanel({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", projectId, "site-updates", page],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/site-updates?page=${page}`);
      if (!res.ok) throw new Error("Failed to load issues");
      return (await res.json()) as { siteUpdates: SiteUpdateRow[]; total: number; page: number; pageSize: number };
    },
  });

  const issues = (data?.siteUpdates ?? []).flatMap((u) =>
    u.issues.map((issue) => ({ ...issue, date: u.date, foremanName: u.foremanUser.name }))
  );
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Issues</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-md bg-muted/40" />
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {page === 1 ? "No issues raised yet." : "No issues on this page."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raised</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Foreman</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="text-muted-foreground">{formatDate(issue.date)}</TableCell>
                    <TableCell className="text-foreground">{issue.description}</TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(issue.severity)}>{issue.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(issue.status)}>{issue.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{issue.foremanName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.total > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
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
        )}
      </CardContent>
    </Card>
  );
}
