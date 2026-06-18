import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { loadUserIdentity, unstable_update } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";

export async function POST(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await requirePermission("platform.superadmin");

    const target = await loadUserIdentity(params.userId);
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await unstable_update({ user: target, impersonatorId: session.user.id });

    await auditLog({
      organisationId: target.organisationId,
      userId: session.user.id,
      action: "impersonation.start",
      entityType: "User",
      entityId: target.id,
      after: { targetEmail: target.email },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
