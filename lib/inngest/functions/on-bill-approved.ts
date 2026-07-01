import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { recomputeForecastSnapshot } from "@/lib/forecast/snapshot";
import { auditLog } from "@/lib/audit";
import { getConfig } from "@/lib/config";

type BillApprovedData = { organisationId: string; billId: string; projectId: string | null };

const APPROVED = "Approved";
const SENT_TO_EZZYBILLS = "Sent to EzzyBills";

/**
 * Fires when a supplier bill is approved (see /api/finance/bills/[id]/approve).
 *
 * Steps:
 * 1. If `automation.billAutoHandoff` Config is "true", auto-advance the bill to
 *    "Sent to EzzyBills" so the accounts team's existing EzzyBills workflow picks
 *    it up without a manual click.
 * 2. Warm the ForecastSnapshot — approved bills count towards cost-vs-budget and
 *    the Director dashboard reads headroom from the persisted snapshot.
 * 3. Write an audit entry.
 *
 * Rule 11 (SELF-CONTAINED): we set status = "Sent to EzzyBills" only. No live
 * API call to Xero or EzzyBills is ever made — the accounts team or a future
 * exporter handles the actual handoff from that status.
 */
export const onBillApproved = inngest.createFunction(
  { id: "on-bill-approved", triggers: [{ event: "finance/bill.approved" }] },
  async ({ event, step }) => {
    const { organisationId, billId, projectId } = event.data as BillApprovedData;

    const autoHandoff = await step.run("load-config", () =>
      getConfig<string>("automation.billAutoHandoff", organisationId).catch(() => "false")
    );

    let advancedToHandoff = false;

    if (autoHandoff === "true") {
      advancedToHandoff = await step.run("advance-to-handoff", async () => {
        const bill = await prisma.supplierBill.findFirst({
          where: { id: billId, organisationId },
          select: { status: true },
        });
        // Only advance if still exactly Approved — manual advancement must still work.
        if (!bill || bill.status !== APPROVED) return false;

        await prisma.supplierBill.update({
          where: { id: billId },
          data: { status: SENT_TO_EZZYBILLS, lastDecisionAt: new Date() },
        });
        return true;
      });
    }

    await step.run("warm-forecast", () => recomputeForecastSnapshot(organisationId));

    await step.run("audit", () =>
      auditLog({
        organisationId,
        action: "automation.bill_xero_handoff",
        entityType: "SupplierBill",
        entityId: billId,
        after: { projectId, advancedToHandoff, finalStatus: advancedToHandoff ? SENT_TO_EZZYBILLS : APPROVED },
      })
    );

    return { billId, projectId, advancedToHandoff };
  }
);
