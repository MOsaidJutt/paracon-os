import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { updateRoleSchema } from "@/lib/validations/role";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("admin.roles");
    const db = getTenantContext(session.user.organisationId);

    const before = await db.role.findFirst({
      where: { id: params.id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (before.isSystem) {
      return NextResponse.json({ error: "System roles cannot be edited" }, { status: 400 });
    }

    const body = updateRoleSchema.parse(await req.json());

    if (body.permissionSlugs?.some((slug) => slug.startsWith("platform."))) {
      return NextResponse.json(
        { error: "Platform-level permissions cannot be assigned to org roles" },
        { status: 400 }
      );
    }

    let permissionIds: string[] | undefined;
    if (body.permissionSlugs) {
      const permissions = await prisma.permission.findMany({
        where: { slug: { in: body.permissionSlugs } },
      });
      if (permissions.length !== body.permissionSlugs.length) {
        return NextResponse.json({ error: "One or more permission slugs are invalid" }, { status: 400 });
      }
      permissionIds = permissions.map((p) => p.id);
    }

    const role = await prisma.$transaction(async (tx) => {
      if (body.name !== undefined) {
        await tx.role.update({ where: { id: params.id }, data: { name: body.name } });
      }
      if (permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: params.id } });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: params.id, permissionId })),
        });
      }
      return tx.role.findUniqueOrThrow({
        where: { id: params.id },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "role.update",
      entityType: "Role",
      entityId: role.id,
      before: { name: before.name, permissionSlugs: before.rolePermissions.map((rp) => rp.permission.slug) },
      after: { name: role.name, permissionSlugs: role.rolePermissions.map((rp) => rp.permission.slug) },
    });

    return NextResponse.json({
      role: {
        id: role.id,
        name: role.name,
        slug: role.slug,
        isSystem: role.isSystem,
        permissionSlugs: role.rolePermissions.map((rp) => rp.permission.slug),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("admin.roles");
    const db = getTenantContext(session.user.organisationId);

    const before = await db.role.findFirst({
      where: { id: params.id },
      include: { _count: { select: { users: true } } },
    });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (before.isSystem) {
      return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 400 });
    }
    if (before._count.users > 0) {
      return NextResponse.json(
        { error: `${before._count.users} user(s) still have this role — reassign them first` },
        { status: 400 }
      );
    }

    const pendingInvites = await db.invite.count({ where: { roleId: params.id, acceptedAt: null } });
    if (pendingInvites > 0) {
      return NextResponse.json(
        { error: `${pendingInvites} pending invite(s) reference this role — cancel them first` },
        { status: 400 }
      );
    }

    await prisma.role.delete({ where: { id: params.id } });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "role.delete",
      entityType: "Role",
      entityId: before.id,
      before: { name: before.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
