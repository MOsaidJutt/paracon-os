import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createLinkedDocumentSchema } from "@/lib/validations/document";
import { assertTargetExists, createLinkedDocument } from "@/lib/documents/service";
import { loadDocumentConfig } from "@/lib/documents/config";

/** Saves a pasted Google Drive URL + metadata — never a live Drive API call, just a stored link. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = createLinkedDocumentSchema.parse(await req.json());

    await assertTargetExists(db, body);
    const config = await loadDocumentConfig(session.user.organisationId);
    const doc = await createLinkedDocument(db, session.user.organisationId, session.user.id, body, config);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document.link_add",
      entityType: "LinkedDocument",
      entityId: doc.id,
      after: { name: doc.name, kind: doc.kind, projectId: doc.projectId, tenderId: doc.tenderId },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
