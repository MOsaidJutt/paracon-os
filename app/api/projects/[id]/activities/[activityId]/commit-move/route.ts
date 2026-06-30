import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { commitMoveSchema } from "@/lib/validations/delay";
import { computeMove, toDownstreamImpacted } from "@/lib/schedule/recalc";
import { assertInList, loadScheduleConfig } from "@/lib/schedule/config";
import { recomputeCriticalPath } from "@/lib/schedule/recompute";
import { syncProjectMilestones } from "@/lib/projects/sync";
import { sendEvent, sendEventWithData } from "@/lib/inngest/send-safe";
import type { DependencyType } from "@/lib/schedule/graph";

/**
 * Commits a previewed move: re-derives the same cascade server-side (never
 * trusts the client's requiresReason flag), 400s if a reason is required but
 * missing/invalid, then persists every cascaded date change in one
 * transaction alongside a DelayRecord capturing what moved, why, and the
 * downstream impact snapshot — the EOT/Notice-of-Delays evidence trail.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string; activityId: string } }) {
  try {
    const session = await requirePermission("program.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.programActivity.findFirst({ where: { id: params.activityId, projectId: params.id } });
    if (!existing) throw new NotFoundError("Program activity not found");

    const body = commitMoveSchema.parse(await req.json());

    const [activities, dependencies] = await Promise.all([
      db.programActivity.findMany({
        where: { projectId: params.id },
        select: { id: true, name: true, startDate: true, endDate: true },
      }),
      db.dependency.findMany({
        where: { predecessor: { projectId: params.id } },
        select: { predecessorId: true, successorId: true, type: true, lagDays: true },
      }),
    ]);

    const { changes, requiresReason } = computeMove(
      activities,
      dependencies.map((d) => ({
        predecessorId: d.predecessorId,
        successorId: d.successorId,
        type: d.type as DependencyType,
        lagDays: d.lagDays,
      })),
      params.activityId,
      body.startDate,
      body.endDate
    );

    if (requiresReason) {
      if (!body.reason) throw new BadRequestError("A delay reason is required when a task is pushed to a later date");
      const config = await loadScheduleConfig(session.user.organisationId);
      assertInList(body.reason, config.delayReasonList, "reason");
    }

    const nameById = new Map(activities.map((a) => [a.id, a.name]));
    const moved = changes.find((c) => c.activityId === params.activityId) ?? {
      activityId: params.activityId,
      previousStartDate: existing.startDate,
      previousEndDate: existing.endDate,
      newStartDate: body.startDate,
      newEndDate: body.endDate,
    };

    await db.$transaction(async (tx) => {
      for (const change of changes) {
        await tx.programActivity.update({
          where: { id: change.activityId },
          data: { startDate: change.newStartDate, endDate: change.newEndDate },
        });
      }

      if (requiresReason) {
        const downstreamImpacted = toDownstreamImpacted(changes, params.activityId, nameById);

        await tx.delayRecord.create({
          data: {
            organisationId: session.user.organisationId,
            projectId: params.id,
            activityId: params.activityId,
            previousStartDate: moved.previousStartDate,
            previousEndDate: moved.previousEndDate,
            newStartDate: moved.newStartDate,
            newEndDate: moved.newEndDate,
            reason: body.reason as string,
            note: body.note ?? null,
            downstreamImpactedJson: downstreamImpacted,
            changedByUserId: session.user.id,
          },
        });
      }
    });

    await recomputeCriticalPath(db, params.id);
    await syncProjectMilestones(db, session.user.organisationId, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "program_activity.move",
      entityType: "ProgramActivity",
      entityId: params.activityId,
      before: { startDate: existing.startDate, endDate: existing.endDate },
      after: { startDate: body.startDate, endDate: body.endDate, reason: body.reason ?? null },
    });
    await sendEvent("forecast/recompute.requested");
    await sendEventWithData("schedule/activity.moved", {
      organisationId: session.user.organisationId,
      projectId: params.id,
      activityId: params.activityId,
    });

    return NextResponse.json({ changes });
  } catch (error) {
    return toErrorResponse(error);
  }
}
