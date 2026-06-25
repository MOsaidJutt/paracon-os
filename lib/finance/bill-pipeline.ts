// Pure status-transition guards for the supplier-bill review pipeline —
// kept separate from bill-review-service.ts (which does the DB reads/writes)
// so the approval gate and pipeline order are unit-testable without a database.

export type BillChecklist = {
  orderedConfirmed: boolean;
  receivedConfirmed: boolean;
  quantityConfirmed: boolean;
  priceConfirmed: boolean;
};

/** The approval gate: every checklist item the PM ticks today must be confirmed before a bill can move to Approved. */
export function canApproveBill(checklist: BillChecklist): boolean {
  return checklist.orderedConfirmed && checklist.receivedConfirmed && checklist.quantityConfirmed && checklist.priceConfirmed;
}

export function canMarkSentToEzzyBills(status: string): boolean {
  return status === "Approved";
}

export function canMarkPaid(status: string): boolean {
  return status === "Sent to EzzyBills" || status === "Approved";
}

export function canMarkReconciled(status: string): boolean {
  return status === "Paid";
}

/** A decision (approve/query/reject) is only valid from these in-review statuses. */
export function isUnderReview(status: string): boolean {
  return status === "Received" || status === "Under review" || status === "Queried";
}
