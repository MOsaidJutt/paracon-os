import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateProspectSchema } from "@/lib/validations/prospect";
import { assertInList, loadProspectConfig } from "@/lib/prospects/config";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("prospect.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateProspectSchema.parse(await req.json());

    const existing = await db.prospect.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Prospect not found");

    if (body.stage) {
      const config = await loadProspectConfig(session.user.organisationId);
      assertInList(body.stage, config.stageList, "stage");
    }

    const prospect = await db.prospect.update({
      where: { id: params.id },
      data: {
        name: body.name,
        contactName: body.contactName,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone,
        address: body.address,
        estimatedValue: body.estimatedValue,
        stage: body.stage,
        notes: body.notes,
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "prospect.update",
      entityType: "Prospect",
      entityId: prospect.id,
      before: { stage: existing.stage },
      after: { stage: prospect.stage },
    });

    return NextResponse.json({ prospect });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("prospect.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.prospect.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Prospect not found");

    await db.prospect.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "prospect.delete",
      entityType: "Prospect",
      entityId: params.id,
      before: { name: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
