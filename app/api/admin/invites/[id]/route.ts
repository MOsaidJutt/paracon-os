import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("admin.users");
    const db = getTenantContext(session.user.organisationId);

    const before = await db.invite.findFirst({ where: { id: params.id, acceptedAt: null } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.invite.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "invite.cancel",
      entityType: "Invite",
      entityId: before.id,
      before: { email: before.email },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
