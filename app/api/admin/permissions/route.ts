import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toErrorResponse } from "@/lib/api-error";

// Platform-only slugs (platform.*) are never offered when building an
// org-scoped custom role — they're reserved for the system super-admin role.
export async function GET() {
  try {
    await requirePermission("admin.roles");

    const permissions = await prisma.permission.findMany({
      where: { slug: { not: { startsWith: "platform." } } },
      orderBy: [{ group: "asc" }, { label: "asc" }],
    });

    return NextResponse.json({ permissions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
