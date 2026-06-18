import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";
import { createInviteSchema } from "@/lib/validations/invite";
import { createInvite } from "@/lib/invites";

export async function GET() {
  try {
    const session = await requirePermission("admin.users");
    const db = getTenantContext(session.user.organisationId);

    const invites = await db.invite.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("admin.users");

    const { ok: withinLimit } = rateLimit(`invite:${session.user.organisationId}`, 20, 60_000);
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many invites sent, try again shortly" }, { status: 429 });
    }

    const db = getTenantContext(session.user.organisationId);
    const body = createInviteSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existingUser = await db.user.findFirst({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    const role = await db.role.findFirst({ where: { id: body.roleId } });
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 400 });
    }

    const organisation = await prisma.organisation.findUniqueOrThrow({
      where: { id: session.user.organisationId },
    });

    const invite = await createInvite({
      organisationId: session.user.organisationId,
      organisationName: organisation.name,
      email,
      roleId: role.id,
      roleName: role.name,
      invitedByUserId: session.user.id,
    });

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "invite.create",
      entityType: "Invite",
      entityId: invite.id,
      after: { email, roleId: role.id },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
