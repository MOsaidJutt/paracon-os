import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { getSignedReadUrl } from "@/lib/storage";

/** Redirects to a freshly-minted signed GET URL for a site photo — never cache the URL itself, only the StoredFile id. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAnyPermission(["site.update", "project.view"]);
    const db = getTenantContext(session.user.organisationId);

    const storedFile = await db.storedFile.findFirst({ where: { id: params.id, category: "Site Photo" } });
    if (!storedFile) throw new NotFoundError("Photo not found");

    const signedUrl = await getSignedReadUrl(storedFile.key);
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    return toErrorResponse(error);
  }
}
