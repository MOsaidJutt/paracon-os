import { prisma } from "./prisma";

interface AuditLogInput {
  organisationId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Inserts an AuditLog row. Call after every mutating server action / route handler. */
export async function auditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organisationId: input.organisationId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before === undefined ? undefined : (input.before as object),
      after: input.after === undefined ? undefined : (input.after as object),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
