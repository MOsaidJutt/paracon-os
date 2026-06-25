import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { requestUploadUrlSchema } from "@/lib/validations/document";
import { assertTargetExists, requestUploadUrl } from "@/lib/documents/service";
import { loadDocumentConfig } from "@/lib/documents/config";

/** Mints a presigned PUT URL so the browser uploads the file straight to storage — our server never sees the bytes. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = requestUploadUrlSchema.parse(await req.json());

    await assertTargetExists(db, body);
    const config = await loadDocumentConfig(session.user.organisationId);
    const result = await requestUploadUrl(session.user.organisationId, body, config);

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
