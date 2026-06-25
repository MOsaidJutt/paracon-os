import { calcGst, round2 } from "./money";

export type VariationLineItem = {
  item: number;
  description: string;
  amount: number;
};

export type VariationTotals = {
  totalExGst: number;
  gst: number;
  totalIncGst: number;
};

/** Mirrors Variation_Template_R2.xlsx: Item|Description|$ rows -> TOTAL (ex GST). GST rate is config-driven (document.gstRatePct). */
export function calcVariationTotals(lineItems: VariationLineItem[], gstRatePct: number): VariationTotals {
  const totalExGst = round2(lineItems.reduce((sum, li) => sum + li.amount, 0));
  const gst = calcGst(totalExGst, gstRatePct);
  return { totalExGst, gst, totalIncGst: round2(totalExGst + gst) };
}
