import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createTenderSchema, listTendersQuerySchema } from "@/lib/validations/tender";
import { assertInList, deriveTenderComputedFields, loadTenderConfig } from "@/lib/tenders/config";

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
      include: {
        client: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ tenders });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createTenderSchema.parse(await req.json());

    const config = await loadTenderConfig(session.user.organisationId);
    assertInList(body.status, config.statusList, "status");
    if (!(body.winProbabilityText in config.winProbWeights)) {
      assertInList(body.winProbabilityText, Object.keys(config.winProbWeights), "winProbabilityText");
    }
    assertInList(body.bidDecision, config.bidDecisionList, "bidDecision");
    assertInList(body.intent, config.intentList, "intent");
    if (body.outcome) assertInList(body.outcome, config.outcomeList, "outcome");

    const client = await db.client.findFirst({ where: { id: body.clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 400 });
    if (body.contactId) {
      const contact = await db.clientContact.findFirst({ where: { id: body.contactId, clientId: body.clientId } });
      if (!contact) return NextResponse.json({ error: "Contact does not belong to that client" }, { status: 400 });
    }

    const computed = deriveTenderComputedFields(
      { value: body.value, winProbabilityText: body.winProbabilityText, received: body.received, due: body.due },
      config
    );

    const tender = await db.tender.create({
      data: {
        organisationId: session.user.organisationId,
        projectName: body.projectName,
        address: body.address,
        status: body.status,
        received: body.received,
        due: body.due,
        submitted: body.submitted,
        value: body.value,
        clientId: body.clientId,
        contactId: body.contactId,
        winProbabilityText: body.winProbabilityText,
        bidDecision: body.bidDecision,
        intent: body.intent,
        reason: body.reason,
        outcome: body.outcome,
        winningBid: body.winningBid,
        winningCo: body.winningCo,
        priceDeltaPct: body.priceDeltaPct,
        marginPct: body.marginPct,
        expectedStart: body.expectedStart,
        expectedEnd: body.expectedEnd,
        expectedLabour: body.expectedLabour ?? undefined,
        ...computed,
      },
      include: { client: { select: { id: true, name: true } }, contact: { select: { id: true, name: true } } },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "tender.create",
      entityType: "Tender",
      entityId: tender.id,
      after: { projectName: tender.projectName, status: tender.status, value: tender.value },
    });

    return NextResponse.json({ tender }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
