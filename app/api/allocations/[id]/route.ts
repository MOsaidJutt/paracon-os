import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { sendEvent } from "@/lib/inngest/send-safe";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("allocation.edit");
    const db = getTenantContext(session.user.organisationId);

    const allocation = await db.allocation.findFirst({ where: { id: params.id } });
    if (!allocation) throw new NotFoundError("Allocation not found");

    await db.allocation.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "allocation.delete",
      entityType: "Allocation",
      entityId: allocation.id,
      before: { workerId: allocation.workerId, projectId: allocation.projectId, weekStart: allocation.weekStart },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
