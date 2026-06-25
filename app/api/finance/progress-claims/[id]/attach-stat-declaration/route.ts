import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { attachStatDeclarationSchema } from "@/lib/validations/progress-claim-commercial";
import { attachStatDeclaration } from "@/lib/finance/progress-claim-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = attachStatDeclarationSchema.parse(await req.json());

    const claim = await attachStatDeclaration(db, session.user.organisationId, session.user.id, params.id, body.statDeclarationFileId);
    return NextResponse.json({ claim });
  } catch (error) {
    return toErrorResponse(error);
  }
}
