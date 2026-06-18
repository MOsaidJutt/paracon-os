import { AuditLogTable } from "@/components/admin/audit/audit-log-table";

export default function AdminAuditPage() {
  return <AuditLogTable apiBase="/api/admin/audit" />;
}
