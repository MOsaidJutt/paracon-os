import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { updateUserSchema } from "@/lib/validations/user";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("admin.users");
    const db = getTenantContext(session.user.organisationId);

    const before = await db.user.findFirst({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = updateUserSchema.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.roleId !== undefined) data.roleId = body.roleId;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password) data.hashedPassword = await bcrypt.hash(body.password, 12);

    const user = await db.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "user.update",
      entityType: "User",
      entityId: user.id,
      before: { name: before.name, isActive: before.isActive, roleId: before.roleId },
      after: { name: user.name, isActive: user.isActive, roleId: body.roleId },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("admin.users");
    const db = getTenantContext(session.user.organisationId);

    const before = await db.user.findFirst({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (before.id === session.user.id) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: params.id },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "user.deactivate",
      entityType: "User",
      entityId: user.id,
      before: { isActive: true },
      after: { isActive: false },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}
