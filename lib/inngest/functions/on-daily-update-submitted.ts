import { inngest } from "@/lib/inngest/client";
import { sendEvent } from "@/lib/inngest/send-safe";
import { auditLog } from "@/lib/audit";

type DailyUpdateSubmittedData = {
  organisationId: string;
  projectId: string;
  dailySiteUpdateId: string;
  date: string;
};

/**
 * Fires when a foreman submits a daily site update (see /api/site/daily-updates).
 *
 * Steps:
 * 1. Trigger a productivity recompute so ProductivityRecord stays warm for scorecards.
 * 2. Trigger a forecast recompute — attendance changes affect labour supply headroom.
 * 3. Write an audit entry confirming the roll-in completed.
 *
 * The dashboards query live from the DB so no separate write is needed here —
 * warming the snapshot is the only cache step required.
 */
export const onDailyUpdateSubmitted = inngest.createFunction(
  { id: "on-daily-update-submitted" },
  { event: "site/daily-update.submitted" },
  async ({ event, step }) => {
    const { organisationId, projectId, dailySiteUpdateId, date } = event.data as DailyUpdateSubmittedData;

    await step.run("warm-productivity", () => sendEvent("productivity/recompute.requested"));

    await step.run("warm-forecast", () => sendEvent("forecast/recompute.requested"));

    await step.run("audit", () =>
      auditLog({
        organisationId,
        action: "automation.site_update_rolled_into_dashboards",
        entityType: "DailySiteUpdate",
        entityId: dailySiteUpdateId,
        after: { projectId, date },
      })
    );

    return { organisationId, projectId, dailySiteUpdateId };
  }
);
