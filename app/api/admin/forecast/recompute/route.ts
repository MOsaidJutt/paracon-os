import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { sendEvent } from "@/lib/inngest/send-safe";
import { recomputeForecastSnapshot } from "@/lib/forecast/snapshot";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";

/**
 * Manual trigger mirroring the compliance recompute route: recomputes
 * synchronously for this org so the UI reflects it immediately, and also
 * sends the event the hourly cron fires so the job runner path is exercised
 * without depending on the Inngest dev server being up.
 */
export async function POST() {
  try {
    const session = await requirePermission("forecast.view");

    const result = await recomputeForecastSnapshot(session.user.organisationId);
    await sendEvent("forecast/recompute.requested");

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "forecast.recompute",
      entityType: "ForecastSnapshot",
      after: { generatedAt: result.generatedAt, shortageCount: result.headroom.shortages.length },
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
