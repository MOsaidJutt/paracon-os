import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { allocateSupplierBillSchema } from "@/lib/validations/supplier-bill";
import { allocateSupplierBill } from "@/lib/finance/bill-review-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = allocateSupplierBillSchema.parse(await req.json());

    const bill = await allocateSupplierBill(db, session.user.organisationId, session.user.id, params.id, body);
    return NextResponse.json({ bill });
  } catch (error) {
    return toErrorResponse(error);
  }
}
