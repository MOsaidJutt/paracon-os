import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { getPmDashboard } from "@/lib/dashboard/pm-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("dashboard.pm");
    const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;

    const dashboard = await getPmDashboard(session.user.organisationId, session.user.id, { projectId });

    return NextResponse.json(dashboard);
  } catch (error) {
    return toErrorResponse(error);
  }
}
