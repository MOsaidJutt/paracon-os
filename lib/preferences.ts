import { prisma } from "./prisma";
import { auditLog } from "./audit";

/**
 * Read/write helpers for the generic per-user preference store
 * (UserPreference). Every preference is namespaced by a short key —
 * "view.mode", "dashboard.simple.rings" — so a new preference is a new key,
 * never a new column.
 *
 * Reads are deliberately forgiving: a missing row, or a row whose stored JSON
 * no longer matches the shape the code expects (an old ring slot id that has
 * since been removed, say), falls back to the caller's default rather than
 * throwing. A preference is never important enough to break a page render.
 */
export async function getPreference<T>(
  organisationId: string,
  userId: string,
  key: string,
  parse: (value: unknown) => T | null
): Promise<T | null> {
  const row = await prisma.userPreference.findUnique({
    where: { organisationId_userId_key: { organisationId, userId, key } },
    select: { valueJson: true },
  });
  if (!row) return null;
  return parse(row.valueJson);
}

/** Upserts a preference and audit-logs the change (CLAUDE.md rule 6 — every write is audited). */
export async function setPreference(
  organisationId: string,
  userId: string,
  key: string,
  valueJson: unknown
): Promise<void> {
  const before = await prisma.userPreference.findUnique({
    where: { organisationId_userId_key: { organisationId, userId, key } },
    select: { valueJson: true },
  });

  const row = await prisma.userPreference.upsert({
    where: { organisationId_userId_key: { organisationId, userId, key } },
    update: { valueJson: valueJson as object },
    create: { organisationId, userId, key, valueJson: valueJson as object },
  });

  await auditLog({
    organisationId,
    userId,
    action: "user_preference.update",
    entityType: "UserPreference",
    entityId: row.id,
    before: before ? { key, valueJson: before.valueJson } : undefined,
    after: { key, valueJson },
  });
}
