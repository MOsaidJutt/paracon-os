import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { loadTenderConfig } from "@/lib/tenders/config";

/** Exposes the Config-driven option lists the tender pipeline UI needs for its dropdowns. */
export async function GET() {
  try {
    const session = await requirePermission("tender.view");
    const config = await loadTenderConfig(session.user.organisationId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error);
  }
}
