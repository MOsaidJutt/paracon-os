import { ConflictError } from "@/lib/errors";

export type ComplianceForGuard = { type: string; status: string; expiryDate: Date | null };
export type ExistingAllocationForGuard = { id: string; projectId: string; weekStart: Date };

/** True if any compliance record has lapsed — "Expiring" is a soft warning only, never a block. */
export function isComplianceExpired(compliance: ComplianceForGuard[]): boolean {
  return compliance.some((c) => c.status === "Expired");
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

/** Throws ConflictError (-> 409) if the worker is compliance-expired or already booked that week. */
export function assertAllocatable(params: {
  compliance: ComplianceForGuard[];
  existing: ExistingAllocationForGuard[];
  weekStart: Date;
  projectId: string;
}): void {
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
