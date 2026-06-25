import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { payProgressClaimSchema } from "@/lib/validations/progress-claim-commercial";
import { payProgressClaim } from "@/lib/finance/progress-claim-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.approve");
    const db = getTenantContext(session.user.organisationId);
    const body = payProgressClaimSchema.parse(await req.json());

    const claim = await payProgressClaim(db, session.user.organisationId, session.user.id, params.id, body.paidAmount, body.paidAt);
    return NextResponse.json({ claim });
  } catch (error) {
    return toErrorResponse(error);
  }
}
