/** Before/after JSON diff block, shared by the central Audit Log table and inline per-record Activity sections. */
export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div>
        <p className="mb-1 font-medium text-foreground">Before</p>
        <pre className="overflow-x-auto rounded bg-background p-2">{JSON.stringify(before, null, 2) ?? "—"}</pre>
      </div>
      <div>
        <p className="mb-1 font-medium text-foreground">After</p>
        <pre className="overflow-x-auto rounded bg-background p-2">{JSON.stringify(after, null, 2) ?? "—"}</pre>
      </div>
    </div>
  );
}
