import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { buildAccountantExportCsv, type AccountantExportRow } from "@/lib/finance/accountant-export";

/** A clean combined CSV of bills + progress claims + values for the accountant — not Xero-specific, just an audit-friendly export. */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;

    const [bills, claims] = await Promise.all([
      db.supplierBill.findMany({
        where: projectId ? { projectId } : {},
        include: { supplier: { select: { company: true } }, project: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.progressClaim.findMany({
        where: { ...(projectId ? { projectId } : {}), status: { in: ["Issued", "Certified", "Paid"] } },
        include: { project: { select: { name: true, client: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const rows: AccountantExportRow[] = [
      ...bills.map((b) => ({
        type: "Bill" as const,
        date: b.invoiceDate,
        reference: b.invoiceNumber ?? b.id,
        project: b.project?.name ?? "Unallocated",
        party: b.supplier?.company ?? b.supplierNameRaw ?? "Unknown supplier",
        amountExGst: b.amountExGst,
        status: b.status,
      })),
      ...claims.map((c) => ({
        type: "Progress Claim" as const,
        date: c.issuedAt,
        reference: c.number,
        project: c.project.name,
        party: c.project.client?.name ?? "—",
        amountExGst: c.claimedAmountExGst,
        status: c.status,
      })),
    ];

    const csv = buildAccountantExportCsv(rows);
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="accountant-export.csv"' },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
