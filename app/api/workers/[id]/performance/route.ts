import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updatePerformanceSchema } from "@/lib/validations/worker";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updatePerformanceSchema.parse(await req.json());

    const existing = await db.worker.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Worker not found");

    const performance = await db.workerPerformance.upsert({
      where: { workerId: params.id },
      update: body,
      create: { workerId: params.id, ...body },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "worker.performance_update",
      entityType: "Worker",
      entityId: params.id,
      after: body,
    });

    return NextResponse.json({ performance });
  } catch (error) {
    return toErrorResponse(error);
  }
}
