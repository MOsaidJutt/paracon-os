import { calcGst, round2, roundUpToNearest } from "./money";

export type MarginFormula = "MARGIN_ON_SELL" | "MARKUP_ON_COST";
export type RoundingBasis = "EX_GST" | "INC_GST";

/**
 * Applies margin to a cost amount to derive the client sell price. Two
 * formulas are supported (document.tenderLetter.marginFormula, config-driven):
 * - MARGIN_ON_SELL: margin as a % of the SELL price -> sell = cost / (1 - margin%)
 * - MARKUP_ON_COST: margin as a % markup on COST    -> sell = cost * (1 + margin%)
 */
export function applyMargin(costAmount: number, marginPct: number, formula: MarginFormula): number {
  if (formula === "MARKUP_ON_COST") return round2(costAmount * (1 + marginPct / 100));
  return round2(costAmount / (1 - marginPct / 100));
}

export type TenderPriceTradeLine = {
  name: string;
  costAmount: number;
};

export type TenderPriceTradeLineResult = {
  name: string;
  costAmount: number;
  sellAmount: number;
};

export type TenderPriceTotals = {
  tradeLines: TenderPriceTradeLineResult[];
  subtotalExGst: number;
  gst: number;
  totalIncGst: number;
};

/**
 * Mirrors the Tender Letter's TENDER PRICE block: per-trade sell amounts
 * (margin applied to cost), summed, then rounded UP to the next configured
 * increment (Paracon's SOP is the next $10,000) before GST/total are derived
 * — applied to whichever subtotal `roundingBasis` names (config-driven), so
 * the rounding rule isn't hard-coded to "ex GST".
 */
export function calcTenderPrice(
  tradeLines: TenderPriceTradeLine[],
  marginPct: number,
  marginFormula: MarginFormula,
  roundingBasis: RoundingBasis,
  roundUpNearest: number,
  gstRatePct: number
): TenderPriceTotals {
  const sellLines = tradeLines.map((line) => ({
    name: line.name,
    costAmount: line.costAmount,
    sellAmount: applyMargin(line.costAmount, marginPct, marginFormula),
  }));
  const rawSubtotalExGst = round2(sellLines.reduce((sum, l) => sum + l.sellAmount, 0));

  if (roundingBasis === "INC_GST") {
    const rawGst = calcGst(rawSubtotalExGst, gstRatePct);
    const rawTotalIncGst = round2(rawSubtotalExGst + rawGst);
    const totalIncGst = roundUpToNearest(rawTotalIncGst, roundUpNearest);
    const subtotalExGst = round2(totalIncGst / (1 + gstRatePct / 100));
    const gst = round2(totalIncGst - subtotalExGst);
    return { tradeLines: sellLines, subtotalExGst, gst, totalIncGst };
  }

  const subtotalExGst = roundUpToNearest(rawSubtotalExGst, roundUpNearest);
  const gst = calcGst(subtotalExGst, gstRatePct);
  return { tradeLines: sellLines, subtotalExGst, gst, totalIncGst: round2(subtotalExGst + gst) };
}
