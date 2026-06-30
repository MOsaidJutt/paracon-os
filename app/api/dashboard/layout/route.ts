import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { auditLog } from "@/lib/audit";
import { BadRequestError } from "@/lib/errors";
import { dashboardKeySchema, dashboardLayoutSchema } from "@/lib/validations/dashboard-layout";

/** Per-user dashboard widget order/visibility — Xero-style "edit dashboard". No special permission: a user always owns their own layout. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const parsedKey = dashboardKeySchema.safeParse(searchParams.get("dashboardKey"));
    if (!parsedKey.success) throw new BadRequestError("dashboardKey must be 'director' or 'pm'");

    const db = getTenantContext(session.user.organisationId);
    const layout = await db.dashboardLayout.findUnique({
      where: {
        organisationId_userId_dashboardKey: {
          organisationId: session.user.organisationId,
          userId: session.user.id,
          dashboardKey: parsedKey.data,
        },
      },
    });

    return NextResponse.json({ widgets: layout?.widgets ?? null });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const { dashboardKey, widgets } = dashboardLayoutSchema.parse(await req.json());
    const db = getTenantContext(session.user.organisationId);

    const layout = await db.dashboardLayout.upsert({
      where: {
        organisationId_userId_dashboardKey: {
          organisationId: session.user.organisationId,
          userId: session.user.id,
          dashboardKey,
        },
      },
      update: { widgets },
      create: { organisationId: session.user.organisationId, userId: session.user.id, dashboardKey, widgets },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "dashboard_layout.update",
      entityType: "DashboardLayout",
      entityId: layout.id,
      after: { dashboardKey, widgets },
    });

    return NextResponse.json({ widgets: layout.widgets });
  } catch (error) {
    return toErrorResponse(error);
  }
}
