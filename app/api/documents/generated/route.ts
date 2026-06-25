import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { listGeneratedDocuments } from "@/lib/documents/generation-service";
import { assertTargetExists } from "@/lib/documents/service";

/** Generated Tender Letters / Variations / Progress Claims for one project or tender — shown above the unified Documents panel. */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("doc.view");
    const db = getTenantContext(session.user.organisationId);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const tenderId = searchParams.get("tenderId") ?? undefined;
    if (!projectId && !tenderId) throw new BadRequestError("projectId or tenderId is required");

    await assertTargetExists(db, { projectId, tenderId });
    const documents = await listGeneratedDocuments(db, { projectId, tenderId });
    return NextResponse.json({ documents });
  } catch (error) {
    return toErrorResponse(error);
  }
}
