import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { markVariationOutstanding } from "@/lib/finance/variation-service";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.approve");
    const db = getTenantContext(session.user.organisationId);

    const variation = await markVariationOutstanding(db, session.user.organisationId, session.user.id, params.id);
    return NextResponse.json({ variation });
  } catch (error) {
    return toErrorResponse(error);
  }
}
