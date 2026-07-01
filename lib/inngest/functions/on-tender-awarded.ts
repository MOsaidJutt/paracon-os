import { inngest } from "@/lib/inngest/client";
import { autoCreateProjectFromTender } from "@/lib/automation/project-setup";
import { prisma } from "@/lib/prisma";
import { recomputeCriticalPath } from "@/lib/schedule/recompute";
import { syncProjectMilestones } from "@/lib/projects/sync";

type TenderAwardedData = { tenderId: string; organisationId: string };

/**
 * Fires when a tender's outcome transitions to a value in
 * `automation.tenderAwardedOutcomes` (e.g. "Won").
 *
 * Steps:
 * 1. Auto-create a Project + Gantt activities from the tender.
 * 2. Recompute critical path + sync milestones for the new project.
 * 3. Warm the forecast snapshot so dashboards reflect the new project immediately.
 */
export const onTenderAwarded = inngest.createFunction(
  { id: "on-tender-awarded", triggers: [{ event: "tender/awarded" }] },
  async ({ event, step }) => {
    const { tenderId, organisationId } = event.data as TenderAwardedData;

    const projectId = await step.run("auto-create-project", () =>
      autoCreateProjectFromTender(tenderId, organisationId)
    );

    if (!projectId) {
      return { skipped: true, reason: "Tender missing expectedStart/expectedEnd or already converted" };
    }

    // Build a minimal TenantContext-compatible proxy so existing helpers work.
    const db = prisma as Parameters<typeof recomputeCriticalPath>[0];

    await step.run("recompute-critical-path", () => recomputeCriticalPath(db, projectId));

    await step.run("sync-milestones", () => syncProjectMilestones(db, organisationId, projectId));

    await step.run("warm-forecast", async () => {
      const { recomputeForecastSnapshot } = await import("@/lib/forecast/snapshot");
      await recomputeForecastSnapshot(organisationId);
    });

    return { projectId, tenderId };
  }
);
