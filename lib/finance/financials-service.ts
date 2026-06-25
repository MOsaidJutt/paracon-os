import type { TenantContext } from "@/lib/tenant";
import { NotFoundError } from "@/lib/errors";
import { calcProjectFinancials, type ProjectFinancialsSummary } from "./financials";
import { calcRetentionHeldToDate } from "./retention";
import { BILL_STATUSES_COUNTED_AS_COST } from "./bill-review-service";

const CLAIMED_STATUSES = ["Issued", "Certified", "Paid"];

export async function loadProjectFinancials(db: TenantContext, projectId: string): Promise<ProjectFinancialsSummary> {
  const project = await db.project.findFirst({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project not found");

  const [approvedVariations, purchaseOrders, bills, claims, releases] = await Promise.all([
    db.variation.findMany({ where: { projectId, status: "Approved" } }),
    db.purchaseOrder.findMany({ where: { projectId, status: { not: "Cancelled" } } }),
    db.supplierBill.findMany({ where: { projectId, status: { in: BILL_STATUSES_COUNTED_AS_COST } } }),
    db.progressClaim.findMany({ where: { projectId, status: { in: CLAIMED_STATUSES } } }),
    db.retentionRelease.findMany({ where: { projectId } }),
  ]);

  const certifiedToDate = claims.reduce((sum, c) => sum + (c.certifiedAmount ?? c.claimedAmountExGst), 0);
  const paidToDate = claims.reduce((sum, c) => sum + c.paidAmount, 0);

  return calcProjectFinancials({
    contractValueBase: project.value,
    approvedVariationsValue: approvedVariations.reduce((sum, v) => sum + v.value, 0),
    costBudget: project.costBudget,
    committedCost: purchaseOrders.reduce((sum, po) => sum + po.value, 0),
    actualCost: bills.reduce((sum, b) => sum + b.amountExGst, 0),
    claimedToDate: claims.reduce((sum, c) => sum + c.claimedAmountExGst, 0),
    certifiedToDate,
    paidToDate,
    retentionHeldToDate: calcRetentionHeldToDate(
      claims.map((c) => c.retentionHeld),
      releases.map((r) => r.amount)
    ),
  });
}
