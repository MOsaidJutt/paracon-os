import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { loadFinanceConfig } from "@/lib/finance/config";

/** Exposes the Config-driven option lists the Finance UI needs for its status dropdowns and filters. */
export async function GET() {
  try {
    const session = await requirePermission("finance.view");
    const config = await loadFinanceConfig(session.user.organisationId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error);
  }
}
