import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { approveSupplierBill } from "@/lib/finance/bill-review-service";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.approve");
    const db = getTenantContext(session.user.organisationId);

    const bill = await approveSupplierBill(db, session.user.organisationId, session.user.id, params.id);
    return NextResponse.json({ bill });
  } catch (error) {
    return toErrorResponse(error);
  }
}
