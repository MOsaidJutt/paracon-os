import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { getOrCreateDraftScore, saveScore, getWorkerScoreHistory } from "@/lib/scorecard/service";
import { loadScorecardConfig } from "@/lib/scorecard/config";
import { saveScoreSchema, monthParamSchema } from "@/lib/validations/scorecard";

export async function GET(req: NextRequest, { params }: { params: { workerId: string } }) {
  try {
    const session = await requirePermission("scorecard.view");

    const periodParam = req.nextUrl.searchParams.get("period");
    const period = periodParam ? monthParamSchema.parse(periodParam) : new Date();

    const [config, score, history] = await Promise.all([
      loadScorecardConfig(session.user.organisationId),
      getOrCreateDraftScore(session.user.organisationId, params.workerId, period),
      getWorkerScoreHistory(session.user.organisationId, params.workerId, period),
    ]);

    return NextResponse.json({ metrics: config.metrics, score, history });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { workerId: string } }) {
  try {
    const session = await requirePermission("scorecard.assess");
    const body = saveScoreSchema.parse(await req.json());

    const score = await saveScore(
      session.user.organisationId,
      params.workerId,
      body.period,
      body.metricScores,
      session.user.id,
      body.note
    );

    return NextResponse.json({ score });
  } catch (error) {
    return toErrorResponse(error);
  }
}
