import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { deriveTenderComputedFields, loadTenderConfig } from "@/lib/tenders/config";
import { formatDocumentNumber, nextCounterValue, tenderCounterScope } from "@/lib/tenders/numbering";

/**
 * "Lead won" path: converts a prospect into a Tender, finding-or-creating the
 * Client (+ContactName) so nothing already on the prospect is re-typed —
 * mirrors the existing Tender -> Project converter's enter-once pattern.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tender.edit");
    if (!session.user.permissions.includes("prospect.edit")) throw new ForbiddenError("prospect.edit");
    const db = getTenantContext(session.user.organisationId);

    const prospect = await db.prospect.findFirst({ where: { id: params.id } });
    if (!prospect) throw new NotFoundError("Prospect not found");
    if (prospect.convertedTenderId) throw new BadRequestError("This prospect has already been converted to a tender");

    const config = await loadTenderConfig(session.user.organisationId);

    const client = await db.client.upsert({
      where: { organisationId_name: { organisationId: session.user.organisationId, name: prospect.name } },
      update: {},
      create: {
        organisationId: session.user.organisationId,
        name: prospect.name,
        address: prospect.address,
        status: config.clientStatusList[0] ?? "Pricing",
      },
    });

    let contactId: string | null = null;
    if (prospect.contactName) {
      const contact = await db.clientContact.upsert({
        where: { clientId_name: { clientId: client.id, name: prospect.contactName } },
        update: {},
        create: {
          clientId: client.id,
          name: prospect.contactName,
          email: prospect.contactEmail,
          phone: prospect.contactPhone,
        },
      });
      contactId = contact.id;
    }

    const value = prospect.estimatedValue ?? 0;
    const winProbabilityText = Object.keys(config.winProbWeights)[0] ?? "";
    const computed = deriveTenderComputedFields(
      { value, winProbabilityText, received: new Date(), due: null },
      config
    );

    const sequence = await nextCounterValue(session.user.organisationId, tenderCounterScope(session.user.organisationId));
    const code = formatDocumentNumber(config.numberPrefix, config.numberPadding, sequence);

    const tender = await db.tender.create({
      data: {
        organisationId: session.user.organisationId,
        code,
        projectName: prospect.name,
        address: prospect.address,
        status: config.statusList[0] ?? "In Progress",
        received: new Date(),
        value,
        clientId: client.id,
        contactId,
        winProbabilityText,
        bidDecision: config.bidDecisionList[0] ?? "",
        intent: config.intentList[0] ?? "",
        ...computed,
      },
    });

    await db.prospect.update({ where: { id: prospect.id }, data: { convertedTenderId: tender.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "prospect.convert_to_tender",
      entityType: "Tender",
      entityId: tender.id,
      after: { prospectId: prospect.id, projectName: tender.projectName },
    });

    return NextResponse.json({ tender }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
