import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createDeliverySchema } from "@/lib/validations/delivery";
import { createDelivery, listDeliveries } from "@/lib/finance/delivery-service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const deliveries = await listDeliveries(db, params.id);
    return NextResponse.json({ deliveries });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createDeliverySchema.parse(await req.json());

    const delivery = await createDelivery(db, session.user.organisationId, params.id, body);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "delivery.create",
      entityType: "Delivery",
      entityId: delivery.id,
      after: { status: delivery.status },
    });

    return NextResponse.json({ delivery }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
