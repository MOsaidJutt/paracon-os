import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { isGoogleDriveConfigured } from "@/lib/google-drive/client";
import { disconnect, getConnectionView } from "@/lib/google-drive/service";

export async function GET() {
  try {
    const session = await requirePermission("admin.settings");
    const connection = await getConnectionView(session.user.organisationId);
    return NextResponse.json({ ...connection, configured: isGoogleDriveConfigured() });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    const session = await requirePermission("admin.settings");
    await disconnect(session.user.organisationId);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "google_drive.disconnect",
      entityType: "GoogleDriveConnection",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
