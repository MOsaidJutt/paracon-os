import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { createLeaveSchema } from "@/lib/validations/worker";
import { sendEvent } from "@/lib/inngest/send-safe";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("labour.view");
    const db = getTenantContext(session.user.organisationId);

    const worker = await db.worker.findFirst({ where: { id: params.id } });
    if (!worker) throw new NotFoundError("Worker not found");

    const leave = await db.workerLeave.findMany({ where: { workerId: params.id }, orderBy: { startDate: "asc" } });
    return NextResponse.json({ leave });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createLeaveSchema.parse(await req.json());

    const worker = await db.worker.findFirst({ where: { id: params.id } });
    if (!worker) throw new NotFoundError("Worker not found");

    const leave = await db.workerLeave.create({
      data: {
        organisationId: session.user.organisationId,
        workerId: params.id,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason,
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "worker.leave_create",
      entityType: "WorkerLeave",
      entityId: leave.id,
      after: { workerId: params.id, startDate: leave.startDate, endDate: leave.endDate },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ leave }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
