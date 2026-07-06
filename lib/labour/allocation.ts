import { ConflictError } from "@/lib/errors";

export type ComplianceForGuard = { type: string; status: string; expiryDate: Date | null };
export type ExistingAllocationForGuard = { id: string; projectId: string; weekStart: Date };

/** True if any compliance record has lapsed — "Expiring" is a soft warning only, never a block. */
export function isComplianceExpired(compliance: ComplianceForGuard[]): boolean {
  return compliance.some((c) => c.status === "Expired");
}

/**
 * True if the worker's trade doesn't match the row/requirement they're being allocated
 * against. The client already blocks this in the drag-and-drop grid, but that's a UI
 * courtesy only — this is the authoritative gate so a direct API call can't silently
 * allocate a worker against a trade requirement they don't hold.
 */
export function isTradeMismatch(workerCapability: string, role: string): boolean {
  return workerCapability !== role;
}

/**
 * Mirrors the Allocation @@unique([organisationId, workerId, weekStart]) constraint —
 * a worker can hold at most one allocation per ISO week, on any project. Used for a
 * friendly pre-check so a double-booking attempt gets a clear 409 instead of a raw
 * constraint violation.
 */
export function findDoubleBooking(
  existing: ExistingAllocationForGuard[],
  weekStart: Date
): ExistingAllocationForGuard | null {
  return existing.find((a) => a.weekStart.getTime() === weekStart.getTime()) ?? null;
}

/**
 * Throws ConflictError (-> 409) if the worker is compliance-expired, already booked that
 * week, or doesn't hold the trade the allocation is being made against.
 */
export function assertAllocatable(params: {
  compliance: ComplianceForGuard[];
  existing: ExistingAllocationForGuard[];
  weekStart: Date;
  projectId: string;
  workerCapability: string;
  role: string;
}): void {
  if (isTradeMismatch(params.workerCapability, params.role)) {
    throw new ConflictError(
      `Worker is a ${params.workerCapability}, not a ${params.role} — cannot allocate against this trade requirement.`
    );
  }

  if (isComplianceExpired(params.compliance)) {
    throw new ConflictError("Worker has expired compliance and cannot be allocated until it's renewed.");
  }

  const clash = findDoubleBooking(params.existing, params.weekStart);
  if (clash) {
    throw new ConflictError(
      clash.projectId === params.projectId
        ? "Worker is already allocated to this project for that week."
        : "Worker is already allocated to another project for that week."
    );
  }
}
