import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { updatePurchaseOrderSchema } from "@/lib/validations/purchase-order";
import { updatePurchaseOrder } from "@/lib/finance/purchase-order-service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; poId: string } }) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updatePurchaseOrderSchema.parse(await req.json());

    const po = await updatePurchaseOrder(db, session.user.organisationId, params.poId, body);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "purchase_order.update",
      entityType: "PurchaseOrder",
      entityId: po.id,
      after: { status: po.status, value: po.value },
    });

    return NextResponse.json({ purchaseOrder: po });
  } catch (error) {
    return toErrorResponse(error);
  }
}
