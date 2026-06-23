/** Win-probability weighting produces fractional worker-equivalents — always round a shortfall UP so the display never understates how many whole workers are needed. */
export function roundShortfall(gap: number): number {
  return Math.ceil(gap);
}

/**
 * Conservative whole-worker rounding for headroom: spare capacity rounds DOWN
 * (never overstate what's available), a shortfall rounds further toward
 * negative (never understate it).
 */
export function roundHeadroom(headroom: number): number {
  return headroom >= 0 ? Math.floor(headroom) : -Math.ceil(-headroom);
}
