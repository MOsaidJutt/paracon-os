import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { dailyUpdateSubmitSchema } from "@/lib/validations/site-update";
import { submitDailyUpdate } from "@/lib/site/daily-update-service";

/** The single-confirm submit — idempotent per (project, foreman, date), so the offline sync queue can safely retry it. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("site.update");
    const db = getTenantContext(session.user.organisationId);
    const body = dailyUpdateSubmitSchema.parse(await req.json());

    const dailyUpdate = await submitDailyUpdate(db, session.user.organisationId, session.user.id, body);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "site.daily_update.submit",
      entityType: "DailySiteUpdate",
      entityId: dailyUpdate.id,
      after: {
        projectId: body.projectId,
        date: body.date,
        attendanceCount: body.attendance.length,
        taskProgressCount: body.taskProgress.length,
        deliveryConfirmationCount: body.deliveryConfirmations.length,
      },
    });

    return NextResponse.json({ dailyUpdate });
  } catch (error) {
    return toErrorResponse(error);
  }
}
