import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createRoleSchema } from "@/lib/validations/role";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Roles & Permissions admin reads/writes only this org's custom roles.
// System roles (organisationId: null, seeded) are visible (so they can be
// assigned to users) but not editable/deletable here.
export async function GET() {
  try {
    const session = await requireAnyPermission(["admin.users", "admin.roles"]);
    const db = getTenantContext(session.user.organisationId);

    const roles = await db.role.findMany({
      orderBy: { name: "asc" },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { users: true, invites: { where: { acceptedAt: null } } } },
      },
    });

    return NextResponse.json({
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        slug: role.slug,
        isSystem: role.isSystem,
        userCount: role._count.users,
        pendingInviteCount: role._count.invites,
        permissionSlugs: role.rolePermissions.map((rp) => rp.permission.slug),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("admin.roles");
    const body = createRoleSchema.parse(await req.json());

    if (body.permissionSlugs.some((slug) => slug.startsWith("platform."))) {
      return NextResponse.json(
        { error: "Platform-level permissions cannot be assigned to org roles" },
        { status: 400 }
      );
    }

    const permissions = await prisma.permission.findMany({
      where: { slug: { in: body.permissionSlugs } },
    });
    if (permissions.length !== body.permissionSlugs.length) {
      return NextResponse.json({ error: "One or more permission slugs are invalid" }, { status: 400 });
    }

    const baseSlug = slugify(body.name) || "role";
    let slug = baseSlug;
    let suffix = 1;
    while (
      await prisma.role.findFirst({
        where: { organisationId: session.user.organisationId, slug },
      })
    ) {
      slug = `${baseSlug}-${++suffix}`;
    }

    const role = await prisma.role.create({
      data: {
        organisationId: session.user.organisationId,
        name: body.name,
        slug,
        rolePermissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
      },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "role.create",
      entityType: "Role",
      entityId: role.id,
      after: { name: role.name, permissionSlugs: body.permissionSlugs },
    });

    return NextResponse.json(
      {
        role: {
          id: role.id,
          name: role.name,
          slug: role.slug,
          isSystem: false,
          userCount: 0,
          pendingInviteCount: 0,
          permissionSlugs: body.permissionSlugs,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
