import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";

export type ComplianceStatus = "Valid" | "Expiring" | "Expired";

/** No expiry date means the document doesn't lapse (e.g. a one-off induction record). */
export function computeComplianceStatus(
  expiryDate: Date | null,
  thresholdDays: number,
  now: Date = new Date()
): ComplianceStatus {
  if (!expiryDate) return "Valid";

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / msPerDay);

  if (daysUntilExpiry < 0) return "Expired";
  if (daysUntilExpiry <= thresholdDays) return "Expiring";
  return "Valid";
}

export type ComplianceStatusChange = {
  id: string;
  workerId: string;
  type: string;
  before: ComplianceStatus;
  after: ComplianceStatus;
};

/**
 * Recomputes Valid/Expiring/Expired for every Compliance row in the org against
 * the current Config threshold, persists changes, and returns the diff so
 * callers (Inngest job, manual trigger) can surface what just changed as an alert.
 */
export async function recomputeAllCompliance(organisationId: string, now: Date = new Date()): Promise<ComplianceStatusChange[]> {
  const thresholdDays = await getConfig<number>("compliance.expiringThresholdDays", organisationId);

  const rows = await prisma.compliance.findMany({
    where: { organisationId },
    select: { id: true, workerId: true, type: true, expiryDate: true, status: true },
  });

  const changes: ComplianceStatusChange[] = [];
  for (const row of rows) {
    const nextStatus = computeComplianceStatus(row.expiryDate, thresholdDays, now);
    if (nextStatus !== row.status) {
      changes.push({ id: row.id, workerId: row.workerId, type: row.type, before: row.status as ComplianceStatus, after: nextStatus });
    }
  }

  await Promise.all(
    changes.map((change) => prisma.compliance.update({ where: { id: change.id }, data: { status: change.after } }))
  );

  return changes;
}
