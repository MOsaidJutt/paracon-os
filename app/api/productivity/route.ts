import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { getProductivityTrends } from "@/lib/scorecard/productivity-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("labour.view");

    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
    const result = await getProductivityTrends(
      session.user.organisationId,
      { trade: params.get("trade") ?? undefined, projectId: params.get("projectId") ?? undefined },
      page
    );

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
