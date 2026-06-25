import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { listKeyStaffForPeriod } from "@/lib/scorecard/service";
import { getConfig } from "@/lib/config";
import { monthKey } from "@/lib/dates";
import { monthParamSchema } from "@/lib/validations/scorecard";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("scorecard.view");

    const periodParam = req.nextUrl.searchParams.get("period");
    const period = periodParam ? monthParamSchema.parse(periodParam) : new Date();

    const [rows, goodThreshold, warningThreshold] = await Promise.all([
      listKeyStaffForPeriod(session.user.organisationId, period),
      getConfig<number>("scorecard.gauge.goodThreshold", session.user.organisationId),
      getConfig<number>("scorecard.gauge.warningThreshold", session.user.organisationId),
    ]);

    return NextResponse.json({ period: monthKey(period), rows, gaugeThresholds: { goodThreshold, warningThreshold } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
