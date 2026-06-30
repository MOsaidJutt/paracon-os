import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

/** Role slugs whose holders receive automation alert emails. */
const ALERT_ROLE_SLUGS = ["director", "project-manager"];

/** Returns active email addresses for users holding any of the alert roles in this org. */
export async function getAlertRecipients(organisationId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      organisationId,
      isActive: true,
      role: { slug: { in: ALERT_ROLE_SLUGS } },
    },
    select: { email: true },
  });
  return users.map((u) => u.email);
}

/**
 * Sends an automation alert email via Resend. No-ops silently if RESEND_API_KEY is
 * unset — the same graceful-degradation pattern as lib/email.ts's invite sender.
 */
export async function sendAlertEmail(input: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  if (input.to.length === 0) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[automation:notify] RESEND_API_KEY not set — skipping email: ${input.subject}`);
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "OneParacon <alerts@paracon.com.au>",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
