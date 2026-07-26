import { nextCounterValue, formatDocumentNumber } from "@/lib/documents/numbering";

export { formatDocumentNumber, nextCounterValue };

/**
 * Org-wide sequential tender numbering scope, e.g. "T001". Unlike PO/VQ/claim
 * numbering (which resets per project), a tender doesn't belong to a project
 * yet — the scope is the whole org, matching how the register itself is a
 * single org-wide list.
 */
export function tenderCounterScope(organisationId: string): string {
  return `TENDER:${organisationId}`;
}
