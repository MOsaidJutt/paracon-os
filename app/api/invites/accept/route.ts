import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";
import { acceptInviteSchema } from "@/lib/validations/invite";

// Public route — no session exists yet. Looked up by hashed token only,
// so a guessed/incomplete token can never enumerate a real invite.
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const { ok: withinLimit } = rateLimit(`invite-accept:${ip}`, 10, 60_000);
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many attempts, try again shortly" }, { status: 429 });
    }

    const body = acceptInviteSchema.parse(await req.json());
    const tokenHash = createHash("sha256").update(body.token).digest("hex");

    const invite = await prisma.invite.findUnique({
      where: { tokenHash },
      include: { organisation: true },
    });

    if (!invite || invite.acceptedAt || invite.expiresAt < new Date() || !invite.organisation.isActive) {
      return NextResponse.json({ error: "This invite link is invalid or has expired" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);

    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findFirst({
          where: { organisationId: invite.organisationId, email: invite.email },
        });
        if (existingUser) throw new Error("ALREADY_ACCEPTED");

        const created = await tx.user.create({
          data: {
            organisationId: invite.organisationId,
            email: invite.email,
            name: body.name,
            hashedPassword,
            roleId: invite.roleId,
          },
        });
        await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
        return created;
      });
    } catch (error) {
      if (error instanceof Error && error.message === "ALREADY_ACCEPTED") {
        return NextResponse.json({ error: "This invite has already been accepted" }, { status: 400 });
      }
      throw error;
    }

    await auditLog({
      organisationId: invite.organisationId,
      userId: user.id,
      action: "invite.accept",
      entityType: "Invite",
      entityId: invite.id,
      after: { email: invite.email, roleId: invite.roleId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
