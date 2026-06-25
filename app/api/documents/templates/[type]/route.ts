import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { defaultDocumentTemplateConfig } from "@/lib/documents/templates-config";
import { isDocumentTemplateType } from "@/lib/validations/document-template";

/** Read-only fetch of a document template's generation config (scope library, qualifications, colours) — used by the generation forms themselves, not the admin editor (gated by doc.generate, not admin.settings). */
export async function GET(_req: Request, { params }: { params: { type: string } }) {
  try {
    const session = await requirePermission("doc.generate");
    const db = getTenantContext(session.user.organisationId);

    if (!isDocumentTemplateType(params.type)) throw new BadRequestError("Unknown document template type");

    const row = await db.documentTemplate.findFirst({ where: { type: params.type } });
    const configJson = row?.isActive === false ? defaultDocumentTemplateConfig(params.type) : row?.configJson ?? defaultDocumentTemplateConfig(params.type);

    return NextResponse.json({ configJson });
  } catch (error) {
    return toErrorResponse(error);
  }
}
