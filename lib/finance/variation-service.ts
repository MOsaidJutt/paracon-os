import type { TenantContext } from "@/lib/tenant";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { auditLog } from "@/lib/audit";
import { assertInList, loadFinanceConfig } from "./config";
import type { VariationSnapshot } from "@/lib/documents/types";

const SUBMITTED = "Submitted";
const APPROVED = "Approved";
const OUTSTANDING = "Outstanding";
const REJECTED = "Rejected";

/** Wraps an already-generated Phase 7 VARIATION document with the commercial Submitted/Approved/Outstanding register row. */
export async function createVariationFromDocument(
  db: TenantContext,
  organisationId: string,
  userId: string,
  generatedDocumentId: string
) {
  const doc = await db.generatedDocument.findFirst({ where: { id: generatedDocumentId, type: "VARIATION" } });
  if (!doc || !doc.projectId) throw new NotFoundError("Variation document not found");

  const existing = await db.variation.findFirst({ where: { generatedDocumentId } });
  if (existing) return existing;

  const snapshot = doc.dataSnapshotJson as VariationSnapshot;

  const variation = await db.variation.create({
    data: {
      organisationId,
      projectId: doc.projectId,
      generatedDocumentId: doc.id,
      number: doc.number,
      value: snapshot.totals.totalExGst,
      status: SUBMITTED,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "variation.create",
    entityType: "Variation",
    entityId: variation.id,
    after: { number: variation.number, value: variation.value },
  });

  return variation;
}

export async function listVariations(db: TenantContext, filter: { projectId?: string }) {
  return db.variation.findMany({
    where: filter.projectId ? { projectId: filter.projectId } : {},
    include: { generatedDocument: { select: { id: true, pdfFileId: true, xlsxFileId: true } } },
    orderBy: { createdAt: "desc" },
  });
}

async function decideVariation(
  db: TenantContext,
  organisationId: string,
  userId: string,
  variationId: string,
  status: string,
  note: string | null
) {
  const config = await loadFinanceConfig(organisationId);
  assertInList(status, config.variationStatusList, "status");

  const existing = await db.variation.findFirst({ where: { id: variationId } });
  if (!existing) throw new NotFoundError("Variation not found");

  const variation = await db.variation.update({
    where: { id: variationId },
    data: { status, note: note ?? existing.note, decidedByUserId: userId, decidedAt: new Date() },
  });

  await auditLog({
    organisationId,
    userId,
    action: `variation.${status.toLowerCase()}`,
    entityType: "Variation",
    entityId: variation.id,
    before: { status: existing.status },
    after: { status },
  });

  return variation;
}

export async function approveVariation(db: TenantContext, organisationId: string, userId: string, variationId: string) {
  return decideVariation(db, organisationId, userId, variationId, APPROVED, null);
}

export async function markVariationOutstanding(db: TenantContext, organisationId: string, userId: string, variationId: string) {
  return decideVariation(db, organisationId, userId, variationId, OUTSTANDING, null);
}

export async function rejectVariation(db: TenantContext, organisationId: string, userId: string, variationId: string, note: string) {
  if (!note) throw new BadRequestError("A note is required to reject a variation");
  return decideVariation(db, organisationId, userId, variationId, REJECTED, note);
}
