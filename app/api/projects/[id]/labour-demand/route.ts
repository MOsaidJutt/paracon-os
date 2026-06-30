import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { aggregateLabourDemand } from "@/lib/projects/calculations";

/** Phase 5 forecast hook: secured labour demand per role per week, derived from this project's program. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("labour.view");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({ where: { id: params.id } });
    if (!project) throw new NotFoundError("Project not found");

    const activities = await db.programActivity.findMany({
      where: { projectId: params.id },
      select: { id: true, parentId: true, startDate: true, endDate: true, labourRequired: true },
    });

    const demand = aggregateLabourDemand(
      activities.map((a) => ({
        id: a.id,
        parentId: a.parentId,
        startDate: a.startDate,
        endDate: a.endDate,
        labourRequired: a.labourRequired as Record<string, number>,
      }))
    );

    return NextResponse.json({ projectId: params.id, demand });
  } catch (error) {
    return toErrorResponse(error);
  }
}
