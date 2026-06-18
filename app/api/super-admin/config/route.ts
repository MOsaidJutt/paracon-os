import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { listPlatformConfigs } from "@/lib/config";
import { toErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    await requirePermission("platform.superadmin");
    const configs = await listPlatformConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    return toErrorResponse(error);
  }
}
