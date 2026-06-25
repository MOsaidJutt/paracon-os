import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateSupplierBillChecklistSchema } from "@/lib/validations/supplier-bill";
import { updateSupplierBillChecklist } from "@/lib/finance/bill-review-service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const bill = await db.supplierBill.findFirst({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, company: true } },
        po: { select: { id: true, number: true, value: true } },
        lastDecisionBy: { select: { id: true, name: true } },
      },
    });
    if (!bill) throw new NotFoundError("Supplier bill not found");

    return NextResponse.json({ bill });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateSupplierBillChecklistSchema.parse(await req.json());

    const bill = await updateSupplierBillChecklist(db, session.user.organisationId, session.user.id, params.id, body);
    return NextResponse.json({ bill });
  } catch (error) {
    return toErrorResponse(error);
  }
}
