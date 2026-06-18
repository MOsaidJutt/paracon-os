import { NextResponse } from "next/server";
import { requireSession, UnauthorisedError } from "@/lib/rbac";
import { loadUserIdentity, unstable_update } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";

// Not gated by requirePermission("platform.superadmin") on purpose — while
// impersonating, the session's *current* permissions are the impersonated
// user's, which won't include platform.superadmin. Gating is instead on
// "is this session currently impersonating at all" (impersonatorId set).
export async function POST() {
  try {
    const session = await requireSession();
    if (!session.impersonatorId) {
      return NextResponse.json({ error: "Not currently impersonating" }, { status: 400 });
    }

    const original = await loadUserIdentity(session.impersonatorId);
    if (!original) throw new UnauthorisedError();

    await unstable_update({ user: original, impersonatorId: null });

    await auditLog({
      organisationId: original.organisationId,
      userId: original.id,
      action: "impersonation.end",
      entityType: "User",
      entityId: session.user.id,
      before: { impersonatedEmail: session.user.email },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
