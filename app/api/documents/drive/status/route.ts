import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { getConnectionView } from "@/lib/google-drive/service";

/** Lightweight "is Drive connected" check for anyone with doc.view — distinct from /api/admin/google-drive, which exposes the connected account's email and is admin.settings-only. */
export async function GET() {
  try {
    const session = await requirePermission("doc.view");
    const connection = await getConnectionView(session.user.organisationId);
    return NextResponse.json({ connected: connection.connected && connection.enabled });
  } catch (error) {
    return toErrorResponse(error);
  }
}
