/** Rounds to the nearest cent — every document calc routes amounts through this before display/storage. */
export function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Rounds UP to the next multiple of `nearest` (e.g. roundUpToNearest(403_201, 10_000) -> 410_000). `nearest <= 0` is a no-op. */
export function roundUpToNearest(amount: number, nearest: number): number {
  if (nearest <= 0) return round2(amount);
  return Math.ceil(amount / nearest) * nearest;
}

export function calcGst(amountExGst: number, gstRatePct: number): number {
  return round2(amountExGst * (gstRatePct / 100));
}
