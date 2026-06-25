import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { getDirectorDashboard } from "@/lib/dashboard/director-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("dashboard.director");
    const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;

    const dashboard = await getDirectorDashboard(session.user.organisationId, { projectId });

    return NextResponse.json(dashboard);
  } catch (error) {
    return toErrorResponse(error);
  }
}
