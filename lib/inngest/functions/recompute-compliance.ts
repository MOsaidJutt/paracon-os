import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { recomputeAllCompliance } from "@/lib/labour/compliance";

/**
 * Recomputes Valid/Expiring/Expired across every org's compliance records.
 * Runs nightly via cron; also runnable on demand (the "Recompute now" admin
 * action) since local/demo environments have no real overnight cron runner.
 */
export const recomputeCompliance = inngest.createFunction(
  { id: "recompute-compliance", triggers: [{ cron: "0 1 * * *" }, { event: "compliance/recompute.requested" }] },
  async ({ step }) => {
    const organisations = await step.run("load-active-organisations", () =>
      prisma.organisation.findMany({ where: { isActive: true }, select: { id: true } })
    );

    const results = await step.run("recompute-all-orgs", async () => {
      const changesByOrg: Record<string, number> = {};
      for (const org of organisations) {
        const changes = await recomputeAllCompliance(org.id);
        changesByOrg[org.id] = changes.length;
      }
      return changesByOrg;
    });

    return { organisationsProcessed: organisations.length, changesByOrg: results };
  }
);
