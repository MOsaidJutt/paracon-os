import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateWorkerSchema } from "@/lib/validations/worker";
import { assertInList, loadLabourConfig } from "@/lib/labour/config";
import { sendEvent } from "@/lib/inngest/send-safe";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("labour.view");
    const db = getTenantContext(session.user.organisationId);

    const worker = await db.worker.findFirst({
      where: { id: params.id },
      include: {
        performance: true,
        compliance: { orderBy: { expiryDate: "asc" } },
        skills: { include: { skill: true } },
      },
    });
    if (!worker) throw new NotFoundError("Worker not found");

    return NextResponse.json({ worker });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateWorkerSchema.parse(await req.json());

    const existing = await db.worker.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Worker not found");

    const config = await loadLabourConfig(session.user.organisationId);
    if (body.capability) assertInList(body.capability, config.capabilityList, "capability");
    if (body.employmentType) assertInList(body.employmentType, config.employmentTypeList, "employmentType");
    if (body.status) assertInList(body.status, config.statusList, "status");

    const worker = await db.worker.update({
      where: { id: params.id },
      data: {
        name: body.name,
        phone: body.phone,
        capability: body.capability,
        employmentType: body.employmentType,
        status: body.status,
        baseLocation: body.baseLocation,
        isKeyStaff: body.isKeyStaff,
      },
      include: { performance: true },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "worker.update",
      entityType: "Worker",
      entityId: worker.id,
      before: { status: existing.status, capability: existing.capability, isKeyStaff: existing.isKeyStaff },
      after: { status: worker.status, capability: worker.capability, isKeyStaff: worker.isKeyStaff },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ worker });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("worker.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.worker.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Worker not found");

    await db.worker.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "worker.delete",
      entityType: "Worker",
      entityId: params.id,
      before: { name: existing.name },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
