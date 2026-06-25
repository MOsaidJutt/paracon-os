import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { submitProgressClaimForReview } from "@/lib/finance/progress-claim-service";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.edit");
    const db = getTenantContext(session.user.organisationId);

    const claim = await submitProgressClaimForReview(db, session.user.organisationId, session.user.id, params.id);
    return NextResponse.json({ claim });
  } catch (error) {
    return toErrorResponse(error);
  }
}
