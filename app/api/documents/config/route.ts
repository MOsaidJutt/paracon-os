import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { loadDocumentConfig } from "@/lib/documents/config";

/** Exposes the Config-driven category/kind lists the Documents panel needs for its dropdowns. */
export async function GET() {
  try {
    const session = await requirePermission("doc.view");
    const config = await loadDocumentConfig(session.user.organisationId);
    return NextResponse.json(config);
  } catch (error) {
    return toErrorResponse(error);
  }
}
