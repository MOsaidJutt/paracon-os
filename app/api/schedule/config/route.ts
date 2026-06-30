import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { loadScheduleConfig } from "@/lib/schedule/config";

/** Exposes the Config-driven option lists the Scheduling & Gantt UI needs (currently: delay reason chips). */
export async function GET() {
  try {
    const session = await requirePermission("project.view");
    const config = await loadScheduleConfig(session.user.organisationId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error);
  }
}
