import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { listKeyStaffForPeriod } from "@/lib/scorecard/service";
import { monthKey } from "@/lib/dates";
import { monthParamSchema } from "@/lib/validations/scorecard";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("scorecard.view");

    const periodParam = req.nextUrl.searchParams.get("period");
    const period = periodParam ? monthParamSchema.parse(periodParam) : new Date();

    const rows = await listKeyStaffForPeriod(session.user.organisationId, period);

    return NextResponse.json({ period: monthKey(period), rows });
  } catch (error) {
    return toErrorResponse(error);
  }
}
