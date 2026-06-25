import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { createProgressClaimCommercialSchema } from "@/lib/validations/progress-claim-commercial";
import { createProgressClaimFromDocument, listProgressClaims } from "@/lib/finance/progress-claim-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;

    const claims = await listProgressClaims(db, { projectId });
    return NextResponse.json({ claims });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createProgressClaimCommercialSchema.parse(await req.json());

    const claim = await createProgressClaimFromDocument(
      db,
      session.user.organisationId,
      session.user.id,
      body.generatedDocumentId,
      body.statDeclarationFileId
    );
    return NextResponse.json({ claim }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
