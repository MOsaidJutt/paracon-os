import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createProspectSchema } from "@/lib/validations/prospect";
import { assertInList, loadProspectConfig } from "@/lib/prospects/config";

export async function GET() {
  try {
    const session = await requirePermission("prospect.view");
    const db = getTenantContext(session.user.organisationId);

    const prospects = await db.prospect.findMany({
      orderBy: { createdAt: "desc" },
      include: { convertedTender: { select: { id: true, projectName: true } } },
    });

    return NextResponse.json({ prospects });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("prospect.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createProspectSchema.parse(await req.json());

    const config = await loadProspectConfig(session.user.organisationId);
    assertInList(body.stage, config.stageList, "stage");

    const prospect = await db.prospect.create({
      data: {
        organisationId: session.user.organisationId,
        name: body.name,
        contactName: body.contactName,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone,
        address: body.address,
        estimatedValue: body.estimatedValue,
        stage: body.stage,
        probability: body.probability,
        nextAction: body.nextAction,
        nextActionDate: body.nextActionDate,
        notes: body.notes,
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "prospect.create",
      entityType: "Prospect",
      entityId: prospect.id,
      after: { name: prospect.name, stage: prospect.stage },
    });

    return NextResponse.json({ prospect }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
