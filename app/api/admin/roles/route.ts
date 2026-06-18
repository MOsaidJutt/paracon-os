import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await requirePermission("admin.users");
    const db = getTenantContext(session.user.organisationId);

    const roles = await db.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });

    return NextResponse.json({ roles });
  } catch (error) {
    return toErrorResponse(error);
  }
}
