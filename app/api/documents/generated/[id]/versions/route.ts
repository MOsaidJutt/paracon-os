import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { listGeneratedDocumentVersions } from "@/lib/documents/generation-service";

/** Superseded versions of one generated document — each still downloadable via the normal /api/documents/stored/{id}/url route, so a "Regenerate" never loses access to what was previously issued. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.view");
    const db = getTenantContext(session.user.organisationId);

    const versions = await listGeneratedDocumentVersions(db, params.id);
    return NextResponse.json({ versions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
