import { AuditLogTable } from "@/components/admin/audit/audit-log-table";

export default function SuperAdminAuditPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every write across every tenant, including impersonation.</p>
      </div>
      <AuditLogTable apiBase="/api/super-admin/audit" showOrgColumn />
    </div>
  );
}
