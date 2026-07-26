import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import {
  WORKER_KPI_PERMISSION,
  getWorkerKpiBreakdown,
  workerKpiMetricSchema,
} from "@/lib/dashboard/worker-kpi-service";

/**
 * The ranked breakdown behind one Worker KPI bar, loaded when a user taps it.
 * Each metric declares its own permission — attendance/hours/compliance are
 * labour.view, the scorecard is scorecard.view (which every role holds).
 */
export async function GET(req: NextRequest) {
  try {
    const parsed = workerKpiMetricSchema.safeParse(req.nextUrl.searchParams.get("metric"));
    if (!parsed.success) throw new BadRequestError("metric must be one of: attendance, hours, compliance, scorecard");

    const session = await requirePermission(WORKER_KPI_PERMISSION[parsed.data]);
    const breakdown = await getWorkerKpiBreakdown(session.user.organisationId, parsed.data);

    return NextResponse.json(breakdown);
  } catch (error) {
    return toErrorResponse(error);
  }
}
