import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { pipelineDemandQuerySchema } from "@/lib/validations/tender";

/**
 * Phase 5 forecast hook: weighted labour demand (role -> count x
 * winProbabilityNumeric) for tenders whose expected build window overlaps
 * [start, end]. Only tenders with both expectedStart/expectedEnd and
 * expectedLabour set contribute — those fields are populated manually
 * (the source xlsx has no equivalent data), so this is empty until an
 * estimator starts filling them in.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("tender.view");
    const db = getTenantContext(session.user.organisationId);

    const { start, end } = pipelineDemandQuerySchema.parse({
      start: req.nextUrl.searchParams.get("start"),
      end: req.nextUrl.searchParams.get("end"),
    });

    const tenders = await db.tender.findMany({
      where: { expectedStart: { not: null }, expectedEnd: { not: null } },
      select: { expectedStart: true, expectedEnd: true, expectedLabour: true, winProbabilityNumeric: true },
    });

    const demand: Record<string, number> = {};
    for (const t of tenders) {
      if (!t.expectedLabour || !t.expectedStart || !t.expectedEnd) continue;
      if (t.expectedStart > end || t.expectedEnd < start) continue;

      for (const [role, count] of Object.entries(t.expectedLabour as Record<string, number>)) {
        demand[role] = (demand[role] ?? 0) + count * t.winProbabilityNumeric;
      }
    }

    return NextResponse.json({ start, end, demand });
  } catch (error) {
    return toErrorResponse(error);
  }
}
