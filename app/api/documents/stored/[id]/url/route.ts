import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { getSignedDocumentUrl } from "@/lib/documents/service";

/**
 * Redirects to a freshly-minted signed GET URL — callers (an <img>/<iframe>
 * src, or a "download" link) always hit this route rather than caching a
 * URL themselves, so an expired link is never an issue.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("doc.view");
    const db = getTenantContext(session.user.organisationId);

    const preview = new URL(req.url).searchParams.get("preview") === "true";
    const signedUrl = await getSignedDocumentUrl(db, params.id, preview);

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    return toErrorResponse(error);
  }
}
