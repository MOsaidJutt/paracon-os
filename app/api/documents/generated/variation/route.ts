import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { generateVariationSchema } from "@/lib/validations/generated-document";
import { generateVariation } from "@/lib/documents/generation-service";

/** Generates a Variation Quotation (VQ-##) PDF + Excel for a project, auto-numbered per project. Enter-once: project/address pulled from the Project record. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.generate");
    const db = getTenantContext(session.user.organisationId);

    const input = generateVariationSchema.parse(await req.json());
    const document = await generateVariation(db, session.user.organisationId, session.user.id, input);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
