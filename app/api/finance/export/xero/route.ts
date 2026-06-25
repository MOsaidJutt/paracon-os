import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { buildXeroBillsCsv } from "@/lib/finance/xero-export";

/** CSV fallback export of Approved bills, in the standard Xero bills-import column shape — no live Xero API call. */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "Approved";

    const bills = await db.supplierBill.findMany({
      where: { status },
      include: { supplier: { select: { company: true } } },
      orderBy: { createdAt: "asc" },
    });

    const csv = buildXeroBillsCsv(
      bills.map((b) => ({
        supplierName: b.supplier?.company ?? b.supplierNameRaw ?? "Unknown supplier",
        invoiceNumber: b.invoiceNumber,
        invoiceDate: b.invoiceDate,
        description: b.invoiceNumber ? `Invoice ${b.invoiceNumber}` : `Bill ${b.id}`,
        amountExGst: b.amountExGst,
      }))
    );

    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="xero-bills-export.csv"' },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
