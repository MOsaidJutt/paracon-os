import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { createActivitySchema } from "@/lib/validations/project";
import { assertInList, loadProjectConfig } from "@/lib/projects/config";
import { syncProjectMilestones } from "@/lib/projects/sync";
import { recomputeCriticalPath } from "@/lib/schedule/recompute";
import { sendEvent } from "@/lib/inngest/send-safe";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({ where: { id: params.id } });
    if (!project) throw new NotFoundError("Project not found");

    const activities = await db.programActivity.findMany({
      where: { projectId: params.id },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ activities });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({
      where: { id: params.id },
      include: { pmUser: { select: { name: true } } },
    });
    if (!project) throw new NotFoundError("Project not found");

    const body = createActivitySchema.parse(await req.json());

    const config = await loadProjectConfig(session.user.organisationId);
    assertInList(body.trade, config.tradeList, "trade");
    assertInList(body.status, config.activityStatusList, "status");
    if (body.milestoneType) assertInList(body.milestoneType, config.milestoneTypeList, "milestoneType");

    if (body.parentId) {
      const parent = await db.programActivity.findFirst({ where: { id: body.parentId, projectId: params.id } });
      if (!parent) return NextResponse.json({ error: "Parent task not found in this project" }, { status: 400 });
    }

    const activity = await db.programActivity.create({
      data: {
        organisationId: session.user.organisationId,
        projectId: params.id,
        parentId: body.parentId ?? null,
        orderIndex: body.orderIndex ?? 0,
        name: body.name,
        trade: body.trade,
        // Never blank: an explicit value wins, an explicit empty string is
        // left as the user's own choice, and only a genuinely omitted field
        // falls back to the project's PM.
        responsible: body.responsible !== undefined ? body.responsible : project.pmUser?.name ?? null,
        startDate: body.startDate,
        endDate: body.endDate,
        isMilestone: body.isMilestone,
        milestoneType: body.milestoneType,
        status: body.status,
        labourRequired: body.labourRequired,
      },
    });

    await recomputeCriticalPath(db, params.id);
    await syncProjectMilestones(db, session.user.organisationId, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "program_activity.create",
      entityType: "ProgramActivity",
      entityId: activity.id,
      after: { name: activity.name, trade: activity.trade, parentId: activity.parentId },
    });
    await sendEvent("forecast/recompute.requested");

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
