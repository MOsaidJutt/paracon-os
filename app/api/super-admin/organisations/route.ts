import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { provisionOrganisation } from "@/lib/organisations";
import { createInvite } from "@/lib/invites";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createOrganisationSchema } from "@/lib/validations/organisation";

export async function GET() {
  try {
    await requirePermission("platform.superadmin");

    const organisations = await prisma.organisation.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json({ organisations });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("platform.superadmin");
    const body = createOrganisationSchema.parse(await req.json());

    const existing = await prisma.organisation.findUnique({ where: { slug: body.slug } });
    if (existing) {
      return NextResponse.json({ error: "An organisation with this slug already exists" }, { status: 400 });
    }

    const { organisationId, directorRoleId } = await provisionOrganisation({
      name: body.name,
      slug: body.slug,
    });

    await createInvite({
      organisationId,
      organisationName: body.name,
      email: body.adminEmail,
      roleId: directorRoleId,
      roleName: "Director",
      invitedByUserId: session.user.id,
    });

    await auditLog({
      organisationId,
      userId: session.user.id,
      action: "organisation.create",
      entityType: "Organisation",
      entityId: organisationId,
      after: { name: body.name, slug: body.slug, adminEmail: body.adminEmail },
    });

    return NextResponse.json({ ok: true, organisationId }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
