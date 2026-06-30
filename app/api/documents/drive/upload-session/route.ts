import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { requestDriveUploadTokenSchema } from "@/lib/validations/google-drive";
import { assertTargetExists } from "@/lib/documents/service";
import { ensureTargetFolder, initiateUploadSession, mintOrgAccessToken } from "@/lib/google-drive/service";

/** Initiates a Drive resumable-upload session so the browser PUTs the file bytes straight to Google — our server never sees a 500MB CAD file's body. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = requestDriveUploadTokenSchema.parse(await req.json());

    await assertTargetExists(db, body);
    const folderId = await ensureTargetFolder(db, session.user.organisationId, body);
    const accessToken = await mintOrgAccessToken(session.user.organisationId);
    const uploadUrl = await initiateUploadSession(accessToken, folderId, body.fileName, body.mimeType);

    return NextResponse.json({ uploadUrl, folderId });
  } catch (error) {
    return toErrorResponse(error);
  }
}
