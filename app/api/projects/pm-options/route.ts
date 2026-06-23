import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";

/** Minimal active-user list for the project manager dropdown — deliberately not gated by admin.users. */
export async function GET() {
  try {
    const session = await requirePermission("project.edit");
    const db = getTenantContext(session.user.organisationId);

    const users = await db.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return toErrorResponse(error);
  }
}
