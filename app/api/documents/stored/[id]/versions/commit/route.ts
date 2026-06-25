import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { registerNewVersionSchema } from "@/lib/validations/document";
import { addNewVersion } from "@/lib/documents/service";

/** Registers the version the client already PUT to the upload-url minted at POST /versions. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.edit");
    const db = getTenantContext(session.user.organisationId);
    const body = registerNewVersionSchema.parse(await req.json());

    const file = await addNewVersion(db, session.user.organisationId, params.id, session.user.id, body);

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "document.new_version",
      entityType: "StoredFile",
      entityId: file.id,
      after: { version: file.version },
    });

    return NextResponse.json({ file });
  } catch (error) {
    return toErrorResponse(error);
  }
}
