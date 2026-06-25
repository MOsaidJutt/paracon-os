import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { assertTargetExists, listDocuments } from "@/lib/documents/service";

/** Unified documents panel — merges StoredFile + LinkedDocument for one project/tender/worker, sorted by date. */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("doc.view");
    const db = getTenantContext(session.user.organisationId);

    const { searchParams } = new URL(req.url);
    const target = {
      projectId: searchParams.get("projectId"),
      tenderId: searchParams.get("tenderId"),
      workerId: searchParams.get("workerId"),
    };

    await assertTargetExists(db, target);
    const documents = await listDocuments(db, target);
    return NextResponse.json({ documents });
  } catch (error) {
    return toErrorResponse(error);
  }
}
