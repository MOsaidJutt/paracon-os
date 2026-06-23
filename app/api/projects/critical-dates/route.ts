import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { filterUpcomingMilestones } from "@/lib/projects/calculations";

/** Critical dates landing in the next 30 days, across every project — feeds the Director/PM dashboard. */
export async function GET() {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const from = new Date();
    const milestones = await db.milestone.findMany({
      where: { date: { gte: from } },
      orderBy: { date: "asc" },
      include: { project: { select: { id: true, name: true, code: true } } },
    });

    const upcoming = filterUpcomingMilestones(milestones, from, 30);

    return NextResponse.json({ milestones: upcoming });
  } catch (error) {
    return toErrorResponse(error);
  }
}
