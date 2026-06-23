import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { createComplianceSchema } from "@/lib/validations/worker";
import { assertInList, loadLabourConfig } from "@/lib/labour/config";
import { computeComplianceStatus } from "@/lib/labour/compliance";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("labour.view");
    const db = getTenantContext(session.user.organisationId);

    const worker = await db.worker.findFirst({ where: { id: params.id } });
    if (!worker) throw new NotFoundError("Worker not found");

    const compliance = await db.compliance.findMany({ where: { workerId: params.id }, orderBy: { expiryDate: "asc" } });
    return NextResponse.json({ compliance });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("compliance.manage");
    const db = getTenantContext(session.user.organisationId);
    const body = createComplianceSchema.parse(await req.json());

    const worker = await db.worker.findFirst({ where: { id: params.id } });
    if (!worker) throw new NotFoundError("Worker not found");

    const config = await loadLabourConfig(session.user.organisationId);
    assertInList(body.type, config.complianceTypeList, "type");

    const status = computeComplianceStatus(body.expiryDate ?? null, config.complianceExpiringThresholdDays);

    const compliance = await db.compliance.create({
      data: {
        organisationId: session.user.organisationId,
        workerId: params.id,
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
      action: "compliance.create",
      entityType: "Compliance",
      entityId: compliance.id,
      after: { workerId: params.id, type: compliance.type, status: compliance.status },
    });

    return NextResponse.json({ compliance }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
