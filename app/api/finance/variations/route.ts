import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { createVariationSchema } from "@/lib/validations/variation-commercial";
import { createVariationFromDocument, listVariations } from "@/lib/finance/variation-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;

    const variations = await listVariations(db, { projectId });
    return NextResponse.json({ variations });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createVariationSchema.parse(await req.json());

    const variation = await createVariationFromDocument(db, session.user.organisationId, session.user.id, body.generatedDocumentId);
    return NextResponse.json({ variation }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
