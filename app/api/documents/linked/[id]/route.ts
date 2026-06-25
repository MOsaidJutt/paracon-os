import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { updateLinkedDocumentSchema } from "@/lib/validations/document";
import { deleteLinkedDocument, updateLinkedDocument } from "@/lib/documents/service";
import { loadDocumentConfig } from "@/lib/documents/config";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = updateLinkedDocumentSchema.parse(await req.json());

    const config = await loadDocumentConfig(session.user.organisationId);
    const doc = await updateLinkedDocument(db, params.id, body, config);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document.link_update",
      entityType: "LinkedDocument",
      entityId: doc.id,
      after: { name: doc.name, kind: doc.kind },
    });

    return NextResponse.json({ document: doc });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);

    await deleteLinkedDocument(db, params.id);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document.link_delete",
      entityType: "LinkedDocument",
      entityId: params.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
