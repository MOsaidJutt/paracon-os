/**
 * RAG banding for percentage KPIs, shared by the server (which decides a
 * band once, so every client renders the same colour) and by the ring/bar
 * components. Lives in lib rather than beside the components because the
 * dashboard service depends on it and lib must not import from components.
 */
export const RAG_BAND_HEX = { good: "#2E7D32", warning: "#ED9B11", bad: "#C62828" } as const;

export type RagBand = keyof typeof RAG_BAND_HEX;

/**
 * Band for a 0-100 percentage where higher is better. Thresholds always come
 * from the caller (Config), never from a constant here.
 */
export function bandForPercent(percent: number, goodThreshold: number, warningThreshold: number): RagBand {
  if (percent >= goodThreshold) return "good";
  if (percent >= warningThreshold) return "warning";
  return "bad";
}
