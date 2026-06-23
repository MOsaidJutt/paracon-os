import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { recomputeForecastSnapshot } from "@/lib/forecast/snapshot";

/**
 * Recomputes the Forecast & Capacity snapshot for every org. Runs hourly via
 * cron, and on-demand whenever a program activity, tender, worker or leave
 * record changes — the UI itself always recomputes live on read, so this job
 * exists to keep the persisted ForecastSnapshot warm for future consumers
 * (Action Centre alerts, dashboards) rather than to gate UI freshness.
 */
export const recomputeForecast = inngest.createFunction(
  { id: "recompute-forecast", triggers: [{ cron: "0 * * * *" }, { event: "forecast/recompute.requested" }] },
  async ({ step }) => {
    const organisations = await step.run("load-active-organisations", () =>
      prisma.organisation.findMany({ where: { isActive: true }, select: { id: true } })
    );

    await step.run("recompute-all-orgs", async () => {
      for (const org of organisations) {
        await recomputeForecastSnapshot(org.id);
      }
    });

    return { organisationsProcessed: organisations.length };
  }
);
