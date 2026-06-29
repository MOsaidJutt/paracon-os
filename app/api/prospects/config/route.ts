import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { loadProspectConfig } from "@/lib/prospects/config";

/** Exposes the Config-driven stage list the prospects register UI needs for its dropdown. */
export async function GET() {
  try {
    const session = await requirePermission("prospect.view");
    const config = await loadProspectConfig(session.user.organisationId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error);
  }
}
