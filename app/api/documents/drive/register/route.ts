import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { registerDriveFileSchema } from "@/lib/validations/google-drive";
import { assertTargetExists, registerDriveLinkedDocument } from "@/lib/documents/service";
import { loadDocumentConfig } from "@/lib/documents/config";
import { ensureTargetFolder } from "@/lib/google-drive/service";

/** Registers a LinkedDocument for a file the browser just uploaded to Drive (or selected via Picker) — called after the Drive-side operation already succeeded. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = registerDriveFileSchema.parse(await req.json());

    await assertTargetExists(db, body);
    const config = await loadDocumentConfig(session.user.organisationId);
    // A Picker selection may point at a file outside any folder OneParacon has
    // created yet (e.g. an existing CAD set the org already had organised in
    // Drive) — ensureTargetFolder still runs so the project/tender's folder
    // link is cached for next time, but the file itself keeps whatever
    // parent Picker reported.
    const folderId = await ensureTargetFolder(db, session.user.organisationId, body);

    const doc = await registerDriveLinkedDocument(
      db,
      session.user.organisationId,
      session.user.id,
      {
        name: body.name,
        kind: body.kind,
        projectId: body.projectId,
        tenderId: body.tenderId,
        driveFileId: body.driveFileId,
        mimeType: body.mimeType,
        size: body.size ?? null,
        webViewLink: body.webViewLink,
        thumbnailLink: body.thumbnailLink,
        parentDriveFolderId: folderId,
        source: body.source,
      },
      config
    );

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: body.source === "upload" ? "document.drive_upload" : "document.drive_pick",
      entityType: "LinkedDocument",
      entityId: doc.id,
      after: { name: doc.name, kind: doc.kind, projectId: doc.projectId, tenderId: doc.tenderId, driveFileId: doc.driveFileId },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
