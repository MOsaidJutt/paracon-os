import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { certifyProgressClaimSchema } from "@/lib/validations/progress-claim-commercial";
import { certifyProgressClaim } from "@/lib/finance/progress-claim-service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.approve");
    const db = getTenantContext(session.user.organisationId);
    const body = certifyProgressClaimSchema.parse(await req.json());

    const claim = await certifyProgressClaim(db, session.user.organisationId, session.user.id, params.id, body.certifiedAmount);
    return NextResponse.json({ claim });
  } catch (error) {
    return toErrorResponse(error);
  }
}
