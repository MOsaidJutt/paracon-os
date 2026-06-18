import { Resend } from "resend";

/**
 * Sends the accept-invite email via Resend. When RESEND_API_KEY isn't set
 * (local dev / demo without a Resend account), logs the invite link to the
 * console instead of failing, so the invite flow still works end-to-end.
 */
export async function sendInviteEmail(input: {
  to: string;
  orgName: string;
  roleName: string;
  inviteUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set — invite link for ${input.to}: ${input.inviteUrl}`
    );
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Paracon OS <onboarding@paracon.com.au>",
    to: input.to,
    subject: `You've been invited to ${input.orgName} on Paracon OS`,
    html: `
      <p>You've been invited to join <strong>${input.orgName}</strong> on Paracon OS as <strong>${input.roleName}</strong>.</p>
      <p><a href="${input.inviteUrl}">Accept the invite</a> to set your password and sign in.</p>
      <p>This link expires in 7 days.</p>
    `,
  });
}
