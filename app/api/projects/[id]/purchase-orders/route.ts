import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createPurchaseOrderSchema } from "@/lib/validations/purchase-order";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/finance/purchase-order-service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const purchaseOrders = await listPurchaseOrders(db, session.user.organisationId, params.id);
    return NextResponse.json({ purchaseOrders });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createPurchaseOrderSchema.parse(await req.json());

    const po = await createPurchaseOrder(db, session.user.organisationId, session.user.id, params.id, body);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "purchase_order.create",
      entityType: "PurchaseOrder",
      entityId: po.id,
      after: { number: po.number, value: po.value },
    });

    return NextResponse.json({ purchaseOrder: po }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
