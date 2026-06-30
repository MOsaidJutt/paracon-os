import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { recomputeAllCompliance } from "@/lib/labour/compliance";
import { sendEventWithData } from "@/lib/inngest/send-safe";

/**
 * Recomputes Valid/Expiring/Expired across every org's compliance records.
 * Runs nightly via cron; also runnable on demand (the "Recompute now" admin
 * action) since local/demo environments have no real overnight cron runner.
 *
 * After recomputing, fires `compliance/expiry.alert` for any org where at least
 * one record just transitioned into Expiring or Expired — the alert function
 * sends the email and writes the audit entry.
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

        // Alert on any Expiring / Expired transitions — load worker names for the email.
        const alertChanges = changes.filter((c) => c.after === "Expiring" || c.after === "Expired");
        if (alertChanges.length > 0) {
          const workerIds = [...new Set(alertChanges.map((c) => c.workerId))];
          const workers = await prisma.worker.findMany({
            where: { id: { in: workerIds } },
            select: { id: true, name: true },
          });
          const nameById = new Map(workers.map((w) => [w.id, w.name]));

          // Load expiry dates for the affected compliance rows.
          const complianceIds = alertChanges.map((c) => c.id);
          const rows = await prisma.compliance.findMany({
            where: { id: { in: complianceIds } },
            select: { id: true, expiryDate: true },
          });
          const expiryById = new Map(rows.map((r) => [r.id, r.expiryDate]));

          await sendEventWithData("compliance/expiry.alert", {
            organisationId: org.id,
            changes: alertChanges.map((c) => ({
              id: c.id,
              workerId: c.workerId,
              workerName: nameById.get(c.workerId) ?? c.workerId,
              type: c.type,
              before: c.before,
              after: c.after,
              expiryDate: expiryById.get(c.id)?.toISOString() ?? null,
            })),
          });
        }
      }
      return changesByOrg;
    });

    return { organisationsProcessed: organisations.length, changesByOrg: results };
  }
);
