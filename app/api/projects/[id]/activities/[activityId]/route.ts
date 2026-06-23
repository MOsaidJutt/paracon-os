import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateActivitySchema } from "@/lib/validations/project";
import { assertInList, loadProjectConfig } from "@/lib/projects/config";
import { syncProjectMilestones } from "@/lib/projects/sync";
import { sendEvent } from "@/lib/inngest/send-safe";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; activityId: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.programActivity.findFirst({
      where: { id: params.activityId, projectId: params.id },
    });
    if (!existing) throw new NotFoundError("Program activity not found");

    const body = updateActivitySchema.parse(await req.json());

    const config = await loadProjectConfig(session.user.organisationId);
    if (body.trade) assertInList(body.trade, config.tradeList, "trade");
    if (body.status) assertInList(body.status, config.activityStatusList, "status");
    if (body.milestoneType) assertInList(body.milestoneType, config.milestoneTypeList, "milestoneType");

    const startDate = body.startDate ?? existing.startDate;
    const endDate = body.endDate ?? existing.endDate;
    if (endDate < startDate) {
      return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
    }

    const activity = await db.programActivity.update({
      where: { id: params.activityId },
      data: {
        name: body.name,
        trade: body.trade,
        startDate: body.startDate,
        endDate: body.endDate,
        isCritical: body.isCritical,
        milestoneType: body.milestoneType,
        status: body.status,
        labourRequired: body.labourRequired,
      },
    });

    await syncProjectMilestones(db, session.user.organisationId, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "program_activity.update",
      entityType: "ProgramActivity",
      entityId: activity.id,
      before: { isCritical: existing.isCritical, status: existing.status },
      after: { isCritical: activity.isCritical, status: activity.status },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ activity });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; activityId: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.programActivity.findFirst({
      where: { id: params.activityId, projectId: params.id },
    });
    if (!existing) throw new NotFoundError("Program activity not found");

    await db.programActivity.delete({ where: { id: params.activityId } });
    await syncProjectMilestones(db, session.user.organisationId, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "program_activity.delete",
      entityType: "ProgramActivity",
      entityId: params.activityId,
      before: { name: existing.name },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
