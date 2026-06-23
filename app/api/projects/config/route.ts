import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { loadProjectConfig } from "@/lib/projects/config";

/** Exposes the Config-driven option lists the Projects & Program UI needs for its dropdowns. */
export async function GET() {
  try {
    const session = await requirePermission("project.view");
    const config = await loadProjectConfig(session.user.organisationId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error);
  }
}
