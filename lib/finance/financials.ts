import { round2 } from "@/lib/documents/money";

export type ProjectFinancialsInput = {
  contractValueBase: number; // Project.value — the original client-facing contract sum
  approvedVariationsValue: number; // sum of Variation.value where status = Approved
  costBudget: number | null; // Project.costBudget — internal budgeted cost, distinct from contract value
  committedCost: number; // sum of PurchaseOrder.value where status != Cancelled
  actualCost: number; // sum of SupplierBill amounts counted as real cost (Approved onward)
  claimedToDate: number; // sum of ProgressClaim.claimedAmountExGst, Issued onward
  certifiedToDate: number;
  paidToDate: number;
  retentionHeldToDate: number;
};

export type ProjectFinancialsSummary = ProjectFinancialsInput & {
  contractValue: number; // contractValueBase + approvedVariationsValue
  marginPlannedPct: number | null; // (contractValue - costBudget) / contractValue
  marginToDatePct: number | null; // (claimedToDate - actualCost) / claimedToDate
};

/**
 * Pure derivation of a project's budget-vs-committed-vs-claimed summary —
 * the caller (lib/finance/financials-service.ts) is responsible for loading
 * the raw sums from the DB; this stays a pure function so the margin/budget
 * math is unit-testable without a database.
 */
export function calcProjectFinancials(input: ProjectFinancialsInput): ProjectFinancialsSummary {
  const contractValue = round2(input.contractValueBase + input.approvedVariationsValue);

  const marginPlannedPct =
    input.costBudget != null && contractValue > 0
      ? round2(((contractValue - input.costBudget) / contractValue) * 100)
      : null;

  const marginToDatePct =
    input.claimedToDate > 0 ? round2(((input.claimedToDate - input.actualCost) / input.claimedToDate) * 100) : null;

  return { ...input, contractValue, marginPlannedPct, marginToDatePct };
}
