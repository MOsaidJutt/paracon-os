import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { testConnection } from "@/lib/google-drive/service";

export async function POST() {
  try {
    const session = await requirePermission("admin.settings");
    await testConnection(session.user.organisationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
