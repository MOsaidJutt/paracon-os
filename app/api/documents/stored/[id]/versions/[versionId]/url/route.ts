import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { getSignedVersionUrl } from "@/lib/documents/service";

export async function GET(_req: NextRequest, { params }: { params: { id: string; versionId: string } }) {
  try {
    const session = await requirePermission("doc.view");
    const db = getTenantContext(session.user.organisationId);
    const signedUrl = await getSignedVersionUrl(db, params.id, params.versionId);
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    return toErrorResponse(error);
  }
}
