import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { loadLabourConfig } from "@/lib/labour/config";

/** Exposes the Config-driven option lists the Labour Intelligence UI needs for its dropdowns. */
export async function GET() {
  try {
    const session = await requirePermission("labour.view");
    const config = await loadLabourConfig(session.user.organisationId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error);
  }
}
