import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { sendEvent } from "@/lib/inngest/send-safe";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; leaveId: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.workerLeave.findFirst({ where: { id: params.leaveId, workerId: params.id } });
    if (!existing) throw new NotFoundError("Leave record not found");

    await db.workerLeave.delete({ where: { id: params.leaveId } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "worker.leave_delete",
      entityType: "WorkerLeave",
      entityId: params.leaveId,
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
