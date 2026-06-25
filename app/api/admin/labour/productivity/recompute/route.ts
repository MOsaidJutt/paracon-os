import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { sendEvent } from "@/lib/inngest/send-safe";
import { recomputeProductivity } from "@/lib/scorecard/productivity-service";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";

/**
 * Manual trigger mirroring the compliance/forecast recompute routes:
 * recomputes this org's current month synchronously so the UI reflects it
 * immediately, and also sends the event the monthly cron fires.
 */
export async function POST() {
  try {
    const session = await requirePermission("worker.edit");

    const result = await recomputeProductivity(session.user.organisationId, new Date());
    await sendEvent("productivity/recompute.requested");

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "productivity.recompute",
      entityType: "ProductivityRecord",
      after: { projectsProcessed: result.projectsProcessed, recordsUpserted: result.recordsUpserted },
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
