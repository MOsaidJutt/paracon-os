"use client";

import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/tenders/format";

type LabourDemandResponse = {
  projectId: string;
  demand: Record<string, Record<string, number>>;
};

export function LabourWeekGrid({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["projects", projectId, "labour-demand"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/labour-demand`);
      if (!res.ok) throw new Error("Failed to load labour demand");
      return (await res.json()) as LabourDemandResponse;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading labour demand...</p>;

  const weeks = Object.keys(data?.demand ?? {}).sort();
  const roles = Array.from(new Set(weeks.flatMap((w) => Object.keys(data!.demand[w])))).sort();

  if (weeks.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No weekly labour requirement set yet — add program activities with crew counts to see demand here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Week of</TableHead>
            {roles.map((role) => (
              <TableHead key={role}>{role}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {weeks.map((week) => (
            <TableRow key={week}>
              <TableCell className="font-medium text-foreground">{formatDate(week)}</TableCell>
              {roles.map((role) => (
                <TableCell key={role}>{data!.demand[week][role] ?? "—"}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
