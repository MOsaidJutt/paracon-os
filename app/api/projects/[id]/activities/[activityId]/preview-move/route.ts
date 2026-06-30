import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { previewMoveSchema } from "@/lib/validations/delay";
import { computeMove, toDownstreamImpacted } from "@/lib/schedule/recalc";
import type { DependencyType } from "@/lib/schedule/graph";

/**
 * Dry-run for dragging a task to a new start/end: returns the full cascade of
 * dates that WOULD change (including downstream tasks) without writing
 * anything, so the Gantt can show the "X downstream tasks impacted" warning
 * and decide whether to prompt for a delay reason before the user commits.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string; activityId: string } }) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.programActivity.findFirst({ where: { id: params.activityId, projectId: params.id } });
    if (!existing) throw new NotFoundError("Program activity not found");

    const body = previewMoveSchema.parse(await req.json());
    if (body.endDate < body.startDate) {
      return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
    }

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

    const nameById = new Map(activities.map((a) => [a.id, a.name]));
    const downstreamImpacted = toDownstreamImpacted(changes, params.activityId, nameById);

    return NextResponse.json({ requiresReason, changes, downstreamImpacted });
  } catch (error) {
    return toErrorResponse(error);
  }
}
