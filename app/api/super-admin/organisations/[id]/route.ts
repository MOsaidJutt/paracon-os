import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { updateOrganisationSchema } from "@/lib/validations/organisation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("platform.superadmin");

    const organisation = await prisma.organisation.findUnique({
      where: { id: params.id },
      include: {
        organisationModules: { include: { module: true } },
        _count: { select: { users: true } },
      },
    });
    if (!organisation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ organisation });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("platform.superadmin");

    const before = await prisma.organisation.findUnique({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = updateOrganisationSchema.parse(await req.json());

    const organisation = await prisma.organisation.update({
      where: { id: params.id },
      data: { isActive: body.isActive },
    });

    await auditLog({
      organisationId: organisation.id,
      userId: session.user.id,
      action: organisation.isActive ? "organisation.reactivate" : "organisation.suspend",
      entityType: "Organisation",
      entityId: organisation.id,
      before: { isActive: before.isActive },
      after: { isActive: organisation.isActive },
    });

    return NextResponse.json({ organisation });
  } catch (error) {
    return toErrorResponse(error);
  }
}
