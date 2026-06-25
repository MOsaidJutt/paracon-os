import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { loadProjectFinancials } from "@/lib/finance/financials-service";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("finance.view");
    const db = getTenantContext(session.user.organisationId);

    const financials = await loadProjectFinancials(db, params.id);
    return NextResponse.json({ financials });
  } catch (error) {
    return toErrorResponse(error);
  }
}
