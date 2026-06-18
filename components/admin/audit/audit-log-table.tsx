"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  user: { name: string; email: string } | null;
  organisation?: { name: string } | null;
};

export function AuditLogTable({
  apiBase = "/api/admin/audit",
  showOrgColumn = false,
}: {
  apiBase?: string;
  showOrgColumn?: boolean;
}) {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [apiBase, action, entityType, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      const res = await fetch(`${apiBase}?${params}`);
      if (!res.ok) throw new Error("Failed to load audit log");
      return (await res.json()) as { logs: AuditLogRow[]; total: number; page: number; pageSize: number };
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const colSpan = showOrgColumn ? 6 : 5;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          aria-label="Filter by action"
          placeholder="Filter by action (e.g. role.update)"
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
          className="max-w-xs"
        />
        <Input
          aria-label="Filter by entity type"
          placeholder="Filter by entity type (e.g. Role)"
          value={entityType}
          onChange={(e) => {
            setPage(1);
            setEntityType(e.target.value);
          }}
          className="max-w-xs"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              {showOrgColumn && <TableHead>Org</TableHead>}
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>By</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                  No audit entries match these filters.
                </TableCell>
              </TableRow>
            )}
            {data?.logs.map((log) => (
              <Fragment key={log.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <TableCell>
                    {expandedId === log.id ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  {showOrgColumn && (
                    <TableCell className="text-muted-foreground">{log.organisation?.name ?? "—"}</TableCell>
                  )}
                  <TableCell className="font-medium text-foreground">{log.action}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.entityType}
                    {log.entityId ? ` (${log.entityId.slice(0, 8)})` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.user ? `${log.user.name} <${log.user.email}>` : "System"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
                {expandedId === log.id && (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="bg-muted/30">
                      <div className="grid grid-cols-2 gap-4 p-2 text-xs">
                        <div>
                          <p className="mb-1 font-medium text-foreground">Before</p>
                          <pre className="overflow-x-auto rounded bg-background p-2">
                            {JSON.stringify(log.before, null, 2) ?? "—"}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-1 font-medium text-foreground">After</p>
                          <pre className="overflow-x-auto rounded bg-background p-2">
                            {JSON.stringify(log.after, null, 2) ?? "—"}
                          </pre>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
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
