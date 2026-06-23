import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateComplianceSchema } from "@/lib/validations/worker";
import { assertInList, loadLabourConfig } from "@/lib/labour/config";
import { computeComplianceStatus } from "@/lib/labour/compliance";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; complianceId: string } }) {
  try {
    const session = await requirePermission("compliance.manage");
    const db = getTenantContext(session.user.organisationId);
    const body = updateComplianceSchema.parse(await req.json());

    const existing = await db.compliance.findFirst({ where: { id: params.complianceId, workerId: params.id } });
    if (!existing) throw new NotFoundError("Compliance record not found");

    const config = await loadLabourConfig(session.user.organisationId);
    if (body.type) assertInList(body.type, config.complianceTypeList, "type");

    const nextExpiryDate = body.expiryDate !== undefined ? body.expiryDate : existing.expiryDate;
    const status = computeComplianceStatus(nextExpiryDate, config.complianceExpiringThresholdDays);

    const compliance = await db.compliance.update({
      where: { id: params.complianceId },
      data: {
        type: body.type,
        reference: body.reference,
        issuedDate: body.issuedDate,
        expiryDate: body.expiryDate,
        status,
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "compliance.update",
      entityType: "Compliance",
      entityId: compliance.id,
      before: { status: existing.status },
      after: { status: compliance.status },
    });

    return NextResponse.json({ compliance });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; complianceId: string } }) {
  try {
    const session = await requirePermission("compliance.manage");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.compliance.findFirst({ where: { id: params.complianceId, workerId: params.id } });
    if (!existing) throw new NotFoundError("Compliance record not found");

    await db.compliance.delete({ where: { id: params.complianceId } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "compliance.delete",
      entityType: "Compliance",
      entityId: params.complianceId,
      before: { type: existing.type },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
