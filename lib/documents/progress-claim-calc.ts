import { calcGst, round2 } from "./money";

/**
 * Mirrors Invoice Proforma Template.xlsx's six columns:
 * Description | %Completed | Contract Value | Value To Be Invoiced | Previously Claimed | This Claim.
 *
 * `previouslyClaimed` is supplied by the caller (lib/documents/generation-service.ts),
 * which reads it off the prior GeneratedDocument for the same project/line —
 * never re-typed by the PM. A brand-new line (no prior claim) passes 0.
 */
export type ProgressClaimLineInput = {
  name: string;
  percentCompleted: number; // 0-100
  contractValue: number;
  previouslyClaimed: number;
};

export type ProgressClaimLineResult = ProgressClaimLineInput & {
  valueToBeInvoiced: number;
  thisClaim: number;
};

export function calcProgressClaimLine(input: ProgressClaimLineInput): ProgressClaimLineResult {
  const valueToBeInvoiced = round2(input.contractValue * (input.percentCompleted / 100));
  const thisClaim = round2(valueToBeInvoiced - input.previouslyClaimed);
  return { ...input, valueToBeInvoiced, thisClaim };
}

export type ProgressClaimSectionSubtotal = {
  contractValue: number;
  valueToBeInvoiced: number;
  previouslyClaimed: number;
  thisClaim: number;
};

export function sumProgressClaimLines(lines: ProgressClaimLineResult[]): ProgressClaimSectionSubtotal {
  return {
    contractValue: round2(lines.reduce((sum, l) => sum + l.contractValue, 0)),
    valueToBeInvoiced: round2(lines.reduce((sum, l) => sum + l.valueToBeInvoiced, 0)),
    previouslyClaimed: round2(lines.reduce((sum, l) => sum + l.previouslyClaimed, 0)),
    thisClaim: round2(lines.reduce((sum, l) => sum + l.thisClaim, 0)),
  };
}

export type ProgressClaimTotals = {
  contractWork: ProgressClaimSectionSubtotal;
  variations: ProgressClaimSectionSubtotal;
  subtotalExGst: number; // sum of both sections' "This Claim" column — the amount actually being invoiced
  gst: number;
  totalIncGst: number;
};

/** GST rate is config-driven (document.gstRatePct), applied to the combined "This Claim" subtotal across both sections. */
export function calcProgressClaimTotals(
  contractWorkLines: ProgressClaimLineResult[],
  variationLines: ProgressClaimLineResult[],
  gstRatePct: number
): ProgressClaimTotals {
  const contractWork = sumProgressClaimLines(contractWorkLines);
  const variations = sumProgressClaimLines(variationLines);
  const subtotalExGst = round2(contractWork.thisClaim + variations.thisClaim);
  const gst = calcGst(subtotalExGst, gstRatePct);
  return { contractWork, variations, subtotalExGst, gst, totalIncGst: round2(subtotalExGst + gst) };
}
