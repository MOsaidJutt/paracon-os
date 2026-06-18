import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { listTendersQuerySchema } from "@/lib/validations/tender";
import { buildTenderExportWorkbook } from "@/lib/tenders/export";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("tender.view");
    const db = getTenantContext(session.user.organisationId);

    const params = req.nextUrl.searchParams;
    const query = listTendersQuerySchema.parse({
      status: params.getAll("status").length > 0 ? params.getAll("status") : undefined,
      clientId: params.get("clientId") ?? undefined,
      search: params.get("search") ?? undefined,
      year: params.get("year") ?? undefined,
      quarter: params.get("quarter") ?? undefined,
      sortBy: params.get("sortBy") ?? undefined,
      sortDir: params.get("sortDir") ?? undefined,
    });

    const tenders = await db.tender.findMany({
      where: {
        status: query.status ? { in: query.status } : undefined,
        clientId: query.clientId,
        year: query.year,
        quarter: query.quarter,
        projectName: query.search ? { contains: query.search } : undefined,
      },
      orderBy: { [query.sortBy]: query.sortDir },
      include: { client: { select: { name: true } }, contact: { select: { name: true } } },
    });

    const buffer = buildTenderExportWorkbook(
      tenders.map((t) => ({
        projectName: t.projectName,
        address: t.address,
        status: t.status,
        received: t.received,
        due: t.due,
        submitted: t.submitted,
        value: t.value,
        clientName: t.client.name,
        contactName: t.contact?.name ?? null,
        winProbabilityText: t.winProbabilityText,
        winProbabilityNumeric: t.winProbabilityNumeric,
        bidDecision: t.bidDecision,
        intent: t.intent,
        reason: t.reason,
        outcome: t.outcome,
        winningBid: t.winningBid,
        winningCo: t.winningCo,
        priceDeltaPct: t.priceDeltaPct,
        valueBand: t.valueBand,
        year: t.year,
        quarter: t.quarter,
        marginPct: t.marginPct,
      }))
    );

    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tender-register-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
