import { prisma } from "@/lib/prisma";

const TRAIL_LIMIT = 20;

/** Tenant-scoped activity history for a single record — the data source behind the inline Activity section. */
export async function getAuditTrail(organisationId: string, entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { organisationId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: TRAIL_LIMIT,
    include: { user: { select: { name: true, email: true } } },
  });
}
