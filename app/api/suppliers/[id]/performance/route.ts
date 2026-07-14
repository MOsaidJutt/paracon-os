import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updatePerformanceSchema } from "@/lib/validations/worker";

/** Same quality/reliability/productivity/safety rating as a worker's — subcontracting companies get rated the same way. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updatePerformanceSchema.parse(await req.json());

    const existing = await db.supplier.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Supplier not found");

    const performance = await db.supplierPerformance.upsert({
      where: { supplierId: params.id },
      update: body,
      create: { supplierId: params.id, ...body },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "supplier.performance_update",
      entityType: "Supplier",
      entityId: params.id,
      after: body,
    });

    return NextResponse.json({ performance });
  } catch (error) {
    return toErrorResponse(error);
  }
}
