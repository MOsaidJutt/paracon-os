import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { registerStoredFileSchema } from "@/lib/validations/document";
import { assertTargetExists, registerStoredFile } from "@/lib/documents/service";
import { loadDocumentConfig } from "@/lib/documents/config";

/** Registers a StoredFile row for an object the client already PUT to a presigned upload-url. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = registerStoredFileSchema.parse(await req.json());

    await assertTargetExists(db, body);
    const config = await loadDocumentConfig(session.user.organisationId);
    const file = await registerStoredFile(db, session.user.organisationId, session.user.id, body, config);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document.upload",
      entityType: "StoredFile",
      entityId: file.id,
      after: { name: file.name, category: file.category, projectId: file.projectId, tenderId: file.tenderId, workerId: file.workerId },
    });

    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
