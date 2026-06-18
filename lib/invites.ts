import { randomBytes, createHash } from "crypto";
import { prisma } from "./prisma";
import { sendInviteEmail } from "./email";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Creates an Invite row (replacing any prior pending one for the same
 * email/org) and emails the accept-invite link. Shared by the org admin
 * "Invite user" flow and Super Admin org creation (which invites the
 * first Director).
 */
export async function createInvite(input: {
  organisationId: string;
  organisationName: string;
  email: string;
  roleId: string;
  roleName: string;
  invitedByUserId: string;
}): Promise<{ id: string }> {
  const email = input.email.toLowerCase();

  await prisma.invite.deleteMany({
    where: { organisationId: input.organisationId, email, acceptedAt: null },
  });

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.invite.create({
    data: {
      organisationId: input.organisationId,
      email,
      roleId: input.roleId,
      tokenHash,
      invitedByUserId: input.invitedByUserId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const inviteUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/accept-invite/${token}`;
  await sendInviteEmail({
    to: email,
    orgName: input.organisationName,
    roleName: input.roleName,
    inviteUrl,
  });

  return { id: invite.id };
}
