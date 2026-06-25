"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/tenders/format";

type SiteUpdateRow = {
  id: string;
  date: string;
  note: string | null;
  submittedAt: string | null;
  foremanUser: { id: string; name: string };
  attendance: { workerId: string; present: boolean; worker: { name: string } }[];
  taskProgress: { status: string; note: string | null; programActivity: { name: string } }[];
  deliveries: { id: string; status: string; supplier: { company: string } | null }[];
  issues: { id: string; description: string; severity: string; status: string }[];
  photos: { id: string; caption: string | null }[];
};

function severityVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  if (severity === "High") return "destructive";
  if (severity === "Medium") return "secondary";
  return "outline";
}

export function SiteUpdatesPanel({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", projectId, "site-updates", page],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/site-updates?page=${page}`);
      if (!res.ok) throw new Error("Failed to load site updates");
      return (await res.json()) as { siteUpdates: SiteUpdateRow[]; total: number; page: number; pageSize: number };
    },
  });

  const updates = data?.siteUpdates ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (isLoading) return <div className="h-24 animate-pulse rounded-md bg-muted/40" />;

  if (updates.length === 0 && page === 1) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Site updates</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No foreman daily updates yet — they&apos;ll appear here as soon as one is submitted from site.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {updates.map((u) => {
        const presentCount = u.attendance.filter((a) => a.present).length;
        return (
          <Card key={u.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{formatDate(u.date)}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {u.foremanUser.name} {u.submittedAt ? "" : "(draft)"}
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-foreground">
                Crew: <span className="font-medium">{presentCount}</span> present
                {u.attendance.length > presentCount ? ` (${u.attendance.length - presentCount} absent)` : ""}
              </p>
              {u.taskProgress.length > 0 && (
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  {u.taskProgress.map((t, i) => (
                    <li key={i}>
                      {t.programActivity.name} — <span className="text-foreground">{t.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              {u.deliveries.length > 0 && (
                <p className="text-muted-foreground">
                  Deliveries: {u.deliveries.map((d) => `${d.supplier?.company ?? "Delivery"} (${d.status})`).join(", ")}
                </p>
              )}
              {u.note && <p className="text-muted-foreground">Note: {u.note}</p>}
              {u.photos.length > 0 && <p className="text-muted-foreground">{u.photos.length} photo(s) attached</p>}
              {u.issues.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {u.issues.map((issue) => (
                    <Badge key={issue.id} variant={severityVariant(issue.severity)}>
                      {issue.severity}: {issue.description}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

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
    </div>
  );
}
