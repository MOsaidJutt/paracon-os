import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { loadTenderConfig } from "@/lib/tenders/config";
import {
  activeStatusesFromWeights,
  calcBidSizeBands,
  calcClientScorecard,
  calcPipelineSummary,
  calcTenderTiming,
  type CalcTender,
} from "@/lib/tenders/calculations";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("tender.view");
    const db = getTenantContext(session.user.organisationId);
    const config = await loadTenderConfig(session.user.organisationId);

    const params = req.nextUrl.searchParams;
    const year = params.get("year") ? Number(params.get("year")) : undefined;
    const quarter = params.get("quarter") ?? undefined;

    const tenders = await db.tender.findMany({
      where: { year, quarter },
      include: { client: { select: { id: true, name: true } } },
    });

    const calcTenders: CalcTender[] = tenders.map((t) => ({
      id: t.id,
      clientId: t.clientId,
      status: t.status,
      value: t.value,
      winProbabilityNumeric: t.winProbabilityNumeric,
      outcome: t.outcome,
      winningBid: t.winningBid,
      valueBand: t.valueBand,
      received: t.received,
      due: t.due,
      submitted: t.submitted,
      tenderDurationDays: t.tenderDurationDays,
    }));

    const activeStatuses = activeStatusesFromWeights(config.statusWeights);
    const clientNameById = new Map(tenders.map((t) => [t.clientId, t.client.name]));

    return NextResponse.json({
      summary: calcPipelineSummary(calcTenders, activeStatuses),
      bidSizeBands: calcBidSizeBands(calcTenders, config.valueBands, activeStatuses),
      timing: calcTenderTiming(calcTenders, activeStatuses),
      clientScorecard: calcClientScorecard(calcTenders, activeStatuses)
        .map((row) => ({ ...row, clientName: clientNameById.get(row.clientId) ?? "Unknown" }))
        .sort((a, b) => b.score - a.score),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
