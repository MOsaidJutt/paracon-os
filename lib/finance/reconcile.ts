import { round2 } from "@/lib/documents/money";

export type PoReconcileResult = {
  poValue: number;
  totalBilled: number;
  variance: number; // totalBilled - poValue
  variancePct: number; // variance as a % of poValue (0 when poValue is 0 and totalBilled is 0)
  overBudget: boolean; // variancePct exceeds the configured tolerance
};

/**
 * Compares a PO's ordered value against what's actually been billed against
 * it (the system's contribution to the PM's "is the price right?" checklist
 * item — it surfaces the variance, the human still ticks the box).
 */
export function reconcilePoAgainstBills(poValue: number, billAmountsExGst: number[], tolerancePct: number): PoReconcileResult {
  const totalBilled = round2(billAmountsExGst.reduce((sum, v) => sum + v, 0));
  const variance = round2(totalBilled - poValue);
  const variancePct = poValue > 0 ? round2((variance / poValue) * 100) : totalBilled > 0 ? 100 : 0;
  return { poValue, totalBilled, variance, variancePct, overBudget: variancePct > tolerancePct };
}
