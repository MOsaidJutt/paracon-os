import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { listConfigsForOrg } from "@/lib/config";
import { toErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await requirePermission("admin.settings");
    const configs = await listConfigsForOrg(session.user.organisationId);
    return NextResponse.json({ configs });
  } catch (error) {
    return toErrorResponse(error);
  }
}
