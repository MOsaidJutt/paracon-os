import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { updateStoredFileSchema } from "@/lib/validations/document";
import { deleteStoredFile, updateStoredFile } from "@/lib/documents/service";
import { loadDocumentConfig } from "@/lib/documents/config";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateStoredFileSchema.parse(await req.json());

    const config = await loadDocumentConfig(session.user.organisationId);
    const file = await updateStoredFile(db, params.id, body, config);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document.update",
      entityType: "StoredFile",
      entityId: file.id,
      after: { category: file.category },
    });

    return NextResponse.json({ file });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);

    await deleteStoredFile(db, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document.delete",
      entityType: "StoredFile",
      entityId: params.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
