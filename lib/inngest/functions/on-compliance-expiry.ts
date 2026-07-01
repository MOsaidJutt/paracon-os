import { inngest } from "@/lib/inngest/client";
import { getAlertRecipients, sendAlertEmail } from "@/lib/automation/notify";
import { auditLog } from "@/lib/audit";

type ComplianceChange = {
  id: string;
  workerId: string;
  workerName: string;
  type: string;
  before: string;
  after: string;
  expiryDate: string | null;
};

type ComplianceExpiryAlertData = {
  organisationId: string;
  changes: ComplianceChange[];
};

/**
 * Fires from recompute-compliance when any record transitions to "Expiring" or "Expired".
 *
 * Steps:
 * 1. Load alert recipients (Director / PM roles for this org).
 * 2. Build a grouped email — Expired records first, then Expiring.
 * 3. Send via Resend.
 * 4. Write a single audit entry summarising how many workers were affected.
 *
 * Allocation blocking is enforced synchronously in lib/labour/allocation.ts
 * (assertAllocatable → isComplianceExpired) at the point of mutation, so there
 * is no race window between this async notification and the block taking effect.
 */
export const onComplianceExpiry = inngest.createFunction(
  { id: "on-compliance-expiry", triggers: [{ event: "compliance/expiry.alert" }] },
  async ({ event, step }) => {
    const { organisationId, changes } = event.data as ComplianceExpiryAlertData;

    const recipients = await step.run("load-recipients", () => getAlertRecipients(organisationId));

    const expired = changes.filter((c) => c.after === "Expired");
    const expiring = changes.filter((c) => c.after === "Expiring");

    const renderRows = (rows: ComplianceChange[]) =>
      rows
        .map((c) => {
          const expiry = c.expiryDate ? new Date(c.expiryDate).toLocaleDateString("en-AU") : "—";
          return `<tr>
            <td style="padding:4px 8px">${c.workerName}</td>
            <td style="padding:4px 8px">${c.type}</td>
            <td style="padding:4px 8px">${c.after}</td>
            <td style="padding:4px 8px">${expiry}</td>
          </tr>`;
        })
        .join("");

    const tableStyle = 'border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px';
    const thStyle = 'padding:6px 8px;text-align:left;background:#f4f3f0;border-bottom:1px solid #ddc8b8';

    const html = `
      <p>The nightly compliance check found ${changes.length} document(s) requiring attention.</p>
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}">Worker</th>
            <th style="${thStyle}">Document type</th>
            <th style="${thStyle}">Status</th>
            <th style="${thStyle}">Expiry date</th>
          </tr>
        </thead>
        <tbody>
          ${renderRows([...expired, ...expiring])}
        </tbody>
      </table>
      <p style="margin-top:16px;color:#C62828">
        <strong>Expired workers cannot be allocated</strong> until their compliance is renewed.
      </p>
      <p>Log in to OneParacon → Labour → Worker record to upload updated documents.</p>
    `;

    await step.run("send-notification", () =>
      sendAlertEmail({
        to: recipients,
        subject: `Compliance alert — ${expired.length} expired, ${expiring.length} expiring`,
        html,
      })
    );

    await step.run("audit", () =>
      auditLog({
        organisationId,
        action: "automation.compliance_alert_sent",
        entityType: "Compliance",
        after: {
          expiredCount: expired.length,
          expiringCount: expiring.length,
          workerIds: changes.map((c) => c.workerId),
        },
      })
    );

    return { organisationId, expiredCount: expired.length, expiringCount: expiring.length };
  }
);
