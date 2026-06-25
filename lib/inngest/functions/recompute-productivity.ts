import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { recomputeProductivity } from "@/lib/scorecard/productivity-service";

/**
 * Recomputes ProductivityRecord for every org's current month. Runs monthly
 * via cron (1st at 02:00); also runnable on demand (the "Recompute now" admin
 * action) since local/demo environments have no real overnight cron runner —
 * mirrors recompute-compliance.ts's shape.
 */
export const recomputeProductivityJob = inngest.createFunction(
  { id: "recompute-productivity", triggers: [{ cron: "0 2 1 * *" }, { event: "productivity/recompute.requested" }] },
  async ({ step }) => {
    const organisations = await step.run("load-active-organisations", () =>
      prisma.organisation.findMany({ where: { isActive: true }, select: { id: true } })
    );

    const results = await step.run("recompute-all-orgs", async () => {
      const recordsByOrg: Record<string, number> = {};
      for (const org of organisations) {
        const result = await recomputeProductivity(org.id, new Date());
        recordsByOrg[org.id] = result.recordsUpserted;
      }
      return recordsByOrg;
    });

    return { organisationsProcessed: organisations.length, recordsByOrg: results };
  }
);
