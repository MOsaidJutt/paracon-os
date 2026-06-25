import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { updateDeliverySchema } from "@/lib/validations/delivery";
import { updateDelivery } from "@/lib/finance/delivery-service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; deliveryId: string } }) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateDeliverySchema.parse(await req.json());

    const delivery = await updateDelivery(db, session.user.organisationId, params.deliveryId, body);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "delivery.update",
      entityType: "Delivery",
      entityId: delivery.id,
      after: { status: delivery.status },
    });

    return NextResponse.json({ delivery });
  } catch (error) {
    return toErrorResponse(error);
  }
}
