import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toErrorResponse } from "@/lib/api-error";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("platform.superadmin");

    const users = await prisma.user.findMany({
      where: { organisationId: params.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return toErrorResponse(error);
  }
}
