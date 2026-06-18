import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { updateTenderSchema } from "@/lib/validations/tender";
import { assertInList, deriveTenderComputedFields, loadTenderConfig } from "@/lib/tenders/config";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.view");
    const db = getTenantContext(session.user.organisationId);

    const tender = await db.tender.findFirst({
      where: { id: params.id },
      include: { client: { select: { id: true, name: true } }, contact: { select: { id: true, name: true } } },
    });
    if (!tender) throw new NotFoundError("Tender not found");

    return NextResponse.json({ tender });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateTenderSchema.parse(await req.json());

    const existing = await db.tender.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Tender not found");

    const config = await loadTenderConfig(session.user.organisationId);
    if (body.status) assertInList(body.status, config.statusList, "status");
    if (body.winProbabilityText && !(body.winProbabilityText in config.winProbWeights)) {
      assertInList(body.winProbabilityText, Object.keys(config.winProbWeights), "winProbabilityText");
    }
    if (body.bidDecision) assertInList(body.bidDecision, config.bidDecisionList, "bidDecision");
    if (body.intent) assertInList(body.intent, config.intentList, "intent");
    if (body.outcome) assertInList(body.outcome, config.outcomeList, "outcome");

    if (body.clientId) {
      const client = await db.client.findFirst({ where: { id: body.clientId } });
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
    if (body.contactId) {
      const contact = await db.clientContact.findFirst({
        where: { id: body.contactId, clientId: body.clientId ?? existing.clientId },
      });
      if (!contact) return NextResponse.json({ error: "Contact does not belong to that client" }, { status: 400 });
    }

    const computed = deriveTenderComputedFields(
      {
        value: body.value ?? existing.value,
        winProbabilityText: body.winProbabilityText ?? existing.winProbabilityText,
        received: body.received !== undefined ? body.received : existing.received,
        due: body.due !== undefined ? body.due : existing.due,
      },
      config
    );

    const tender = await db.tender.update({
      where: { id: params.id },
      data: {
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
      action: "tender.update",
      entityType: "Tender",
      entityId: tender.id,
      before: { status: existing.status, value: existing.value },
      after: { status: tender.status, value: tender.value },
    });

    return NextResponse.json({ tender });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);

    const existing = await db.tender.findFirst({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Tender not found");

    await db.tender.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "tender.delete",
      entityType: "Tender",
      entityId: params.id,
      before: { projectName: existing.projectName },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
