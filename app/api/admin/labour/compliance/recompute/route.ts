import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { sendEvent } from "@/lib/inngest/send-safe";
import { recomputeAllCompliance } from "@/lib/labour/compliance";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";

/**
 * Demo/admin trigger for the nightly compliance recompute. Sends the same
 * event the cron schedule fires, and also recomputes synchronously for this
 * org so the UI reflects the result immediately without depending on the
 * Inngest dev server being up.
 */
export async function POST() {
  try {
    const session = await requirePermission("compliance.manage");

    const changes = await recomputeAllCompliance(session.user.organisationId);
    await sendEvent("compliance/recompute.requested");

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "compliance.recompute",
      entityType: "Compliance",
      after: { changeCount: changes.length },
    });

    return NextResponse.json({ changes });
  } catch (error) {
    return toErrorResponse(error);
  }
}
