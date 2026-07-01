import { inngest } from "@/lib/inngest/client";
import { recomputeForecastSnapshot } from "@/lib/forecast/snapshot";
import { checkCapacityShortages } from "@/lib/automation/capacity-check";
import { getAlertRecipients, sendAlertEmail } from "@/lib/automation/notify";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type ActivityMovedData = { organisationId: string; projectId: string; activityId: string };

/**
 * Fires after a Gantt activity date change is committed (see commit-move route).
 *
 * Steps:
 * 1. Recompute the ForecastSnapshot for this org (activity dates changed labour demand).
 * 2. Read headroomJson and check for capacity shortages.
 * 3. If shortages exist: email Director/PM users and write an audit entry.
 */
export const onActivityMoved = inngest.createFunction(
  { id: "on-activity-moved", triggers: [{ event: "schedule/activity.moved" }] },
  async ({ event, step }) => {
    const { organisationId, projectId, activityId } = event.data as ActivityMovedData;

    await step.run("recompute-forecast", () => recomputeForecastSnapshot(organisationId));

    const report = await step.run("check-capacity", () => checkCapacityShortages(organisationId));

    if (!report.hasShortage) {
      return { organisationId, projectId, activityId, hasShortage: false };
    }

    const [recipients, project] = await step.run("load-context", () =>
      Promise.all([
        getAlertRecipients(organisationId),
        prisma.project.findFirst({
          where: { id: projectId, organisationId },
          select: { name: true, code: true },
        }),
      ])
    );

    const projectLabel = project ? `${project.code} — ${project.name}` : projectId;

    await step.run("send-notification", () =>
      sendAlertEmail({
        to: recipients,
        subject: `Capacity shortage detected after schedule update — ${projectLabel}`,
        html: `
          <p>A schedule change on project <strong>${projectLabel}</strong> has caused one or more
          capacity shortages in the labour forecast.</p>
          <p><strong>Affected roles / periods:</strong></p>
          ${report.summaryHtml}
          <p>Log in to OneParacon to review the Resource Planner and adjust allocations.</p>
        `,
      })
    );

    await step.run("audit", () =>
      auditLog({
        organisationId,
        action: "automation.capacity_shortage_detected",
        entityType: "Project",
        entityId: projectId,
        after: { shortageCount: report.shortages.length, triggeredByActivityId: activityId },
      })
    );

    return { organisationId, projectId, activityId, hasShortage: true, shortageCount: report.shortages.length };
  }
);
