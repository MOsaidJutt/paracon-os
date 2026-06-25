import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { lockScore, unlockScore } from "@/lib/scorecard/service";
import { monthQuerySchema, monthParamSchema } from "@/lib/validations/scorecard";

export async function POST(req: NextRequest, { params }: { params: { workerId: string } }) {
  try {
    const session = await requirePermission("scorecard.assess");
    const body = monthQuerySchema.parse(await req.json());

    const score = await lockScore(session.user.organisationId, params.workerId, body.period, session.user.id);

    return NextResponse.json({ score });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { workerId: string } }) {
  try {
    const session = await requirePermission("scorecard.assess");
    const periodParam = req.nextUrl.searchParams.get("period");
    if (!periodParam) throw new BadRequestError("period query param is required");
    const period = monthParamSchema.parse(periodParam);

    const score = await unlockScore(session.user.organisationId, params.workerId, period, session.user.id);

    return NextResponse.json({ score });
  } catch (error) {
    return toErrorResponse(error);
  }
}
