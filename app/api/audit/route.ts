import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/rbac";
import { getAuditTrail } from "@/lib/audit/get-trail";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";

// Same viewing permission as the record itself — anyone who can see a Project
// can see its change history; this is a convenience view, not a separate
// privilege (the searchable central log at /admin/audit stays admin-gated).
const VIEW_PERMISSIONS_BY_ENTITY: Record<string, string[]> = {
  Project: ["project.view"],
  Worker: ["labour.view"],
  Tender: ["tender.view"],
  Client: ["tender.view", "labour.view"],
  Supplier: ["tender.view", "labour.view"],
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    if (!entityType || !entityId) throw new BadRequestError("entityType and entityId are required");

    const permissions = VIEW_PERMISSIONS_BY_ENTITY[entityType];
    if (!permissions) throw new BadRequestError(`Unsupported entityType: ${entityType}`);

    const session = await requireAnyPermission(permissions);
    const logs = await getAuditTrail(session.user.organisationId, entityType, entityId);
    return NextResponse.json({ logs });
  } catch (error) {
    return toErrorResponse(error);
  }
}
