import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";

/** Inline per-task change history (FEEDBACK_NOTES §8) — shown on the task itself, not only in the central Audit Log. */
export async function GET(_req: NextRequest, { params }: { params: { id: string; activityId: string } }) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.programActivity.findFirst({ where: { id: params.activityId, projectId: params.id } });
    if (!existing) throw new NotFoundError("Program activity not found");

    const delayRecords = await db.delayRecord.findMany({
      where: { activityId: params.activityId },
      orderBy: { createdAt: "desc" },
      include: { changedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ delayRecords });
  } catch (error) {
    return toErrorResponse(error);
  }
}
