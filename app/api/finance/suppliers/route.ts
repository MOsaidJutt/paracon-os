import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";

/** A finance-scoped supplier lookup for PO/delivery/bill forms — avoids requiring tender.view (which a PM/finance reviewer may not hold) just to populate a dropdown. */
export async function GET() {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const suppliers = await db.supplier.findMany({ orderBy: { company: "asc" }, select: { id: true, company: true, trade: true, email: true } });
    return NextResponse.json({ suppliers });
  } catch (error) {
    return toErrorResponse(error);
  }
}
