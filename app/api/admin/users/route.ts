import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { createUserSchema } from "@/lib/validations/user";

export async function GET() {
  try {
    const session = await requirePermission("admin.users");
    const db = getTenantContext(session.user.organisationId);

    const users = await db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("admin.users");
    const db = getTenantContext(session.user.organisationId);

    const body = createUserSchema.parse(await req.json());

    const existing = await db.user.findFirst({ where: { email: body.email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    const role = await db.role.findFirst({ where: { id: body.roleId } });
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const user = await db.user.create({
      data: {
        organisationId: session.user.organisationId,
        name: body.name,
        email: body.email.toLowerCase(),
        hashedPassword,
        roleId: body.roleId,
      },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      after: { name: user.name, email: user.email, roleId: body.roleId },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
