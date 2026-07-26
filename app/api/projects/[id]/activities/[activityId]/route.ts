import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateActivitySchema } from "@/lib/validations/project";
import { assertInList, loadProjectConfig } from "@/lib/projects/config";
import { syncProjectMilestones } from "@/lib/projects/sync";
import { recomputeCriticalPath } from "@/lib/schedule/recompute";
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

    // A task with any dependency must be rescheduled through the
    // preview-move/commit-move endpoints, which cascade dependent dates and
    // capture a delay reason when the push is to a later date — a plain
    // PATCH would silently bypass both.
    const datesChanging =
      (body.startDate !== undefined && body.startDate.getTime() !== existing.startDate.getTime()) ||
      (body.endDate !== undefined && body.endDate.getTime() !== existing.endDate.getTime());
    if (datesChanging) {
      const hasDependency = await db.dependency.findFirst({
        where: { OR: [{ predecessorId: params.activityId }, { successorId: params.activityId }] },
      });
      if (hasDependency) {
        return NextResponse.json(
          { error: "This task has dependencies — reschedule it via the schedule move endpoint so dependent dates and delay tracking stay in sync." },
          { status: 400 }
        );
      }
    }

    if (body.parentId !== undefined && body.parentId !== null) {
      if (body.parentId === params.activityId) {
        return NextResponse.json({ error: "A task cannot be its own parent" }, { status: 400 });
      }
      const parent = await db.programActivity.findFirst({ where: { id: body.parentId, projectId: params.id } });
      if (!parent) return NextResponse.json({ error: "Parent task not found in this project" }, { status: 400 });

      // Walk the new parent's ancestor chain — re-parenting under one of this
      // task's own descendants would create a cycle in the hierarchy tree.
      let cursor: { id: string; parentId: string | null } | null = parent;
      while (cursor?.parentId) {
        if (cursor.parentId === params.activityId) {
          return NextResponse.json({ error: "Cannot move a task under its own descendant" }, { status: 400 });
        }
        cursor = await db.programActivity.findFirst({
          where: { id: cursor.parentId },
          select: { id: true, parentId: true },
        });
      }
    }

    const activity = await db.programActivity.update({
      where: { id: params.activityId },
      data: {
        name: body.name,
        trade: body.trade,
        responsible: body.responsible,
        startDate: body.startDate,
        endDate: body.endDate,
        parentId: body.parentId,
        orderIndex: body.orderIndex,
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
      action: "program_activity.update",
      entityType: "ProgramActivity",
      entityId: activity.id,
      before: { status: existing.status, startDate: existing.startDate, endDate: existing.endDate },
      after: { status: activity.status, startDate: activity.startDate, endDate: activity.endDate },
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
    await recomputeCriticalPath(db, params.id);
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
