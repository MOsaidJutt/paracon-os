import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { auditLog } from "@/lib/audit";
import { BadRequestError } from "@/lib/errors";
import { documentTemplateConfigSchemaByType, isDocumentTemplateType } from "@/lib/validations/document-template";

/** Saves an org's override for one document template's generation config (scope library / qualifications / PDF colours). Gated by doc.edit — Estimator owns Tender Letter, PM owns Variation/Progress Claim. */
export async function PATCH(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);

    if (!isDocumentTemplateType(params.type)) throw new BadRequestError("Unknown document template type");
    const schema = documentTemplateConfigSchemaByType[params.type];
    const configJson = schema.parse(await req.json());

    const template = await db.documentTemplate.upsert({
      where: { organisationId_type: { organisationId: session.user.organisationId, type: params.type } },
      update: { configJson },
      create: { organisationId: session.user.organisationId, type: params.type, configJson },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document_template.update",
      entityType: "DocumentTemplate",
      entityId: template.id,
      after: { type: params.type },
    });

    return NextResponse.json({ template });
  } catch (error) {
    return toErrorResponse(error);
  }
}
