import { nextCounterValue, formatDocumentNumber } from "@/lib/documents/numbering";

export { formatDocumentNumber, nextCounterValue };

/** Per-project sequential PO numbering, e.g. "PO-01" — mirrors the Phase 7 VQ-##/Claim # scheme. */
export function purchaseOrderCounterScope(projectId: string): string {
  return `PO:${projectId}`;
}
