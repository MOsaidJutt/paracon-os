import type { TenantContext } from "@/lib/tenant";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { auditLog } from "@/lib/audit";
import { assertInList, loadFinanceConfig } from "./config";
import { calcRetentionForClaim } from "./retention";
import type { ProgressClaimSnapshot } from "@/lib/documents/types";

const DRAFT = "Draft";
const UNDER_REVIEW = "Under review";
const APPROVED = "Approved";
const ISSUED = "Issued";
const CERTIFIED = "Certified";
const PAID = "Paid";

async function loadAdjustedContractValue(db: TenantContext, projectId: string): Promise<number> {
  const project = await db.project.findFirstOrThrow({ where: { id: projectId } });
  const approvedVariations = await db.variation.findMany({ where: { projectId, status: "Approved" } });
  return project.value + approvedVariations.reduce((sum, v) => sum + v.value, 0);
}

/** Wraps an already-generated Phase 7 PROGRESS_CLAIM document with the internal review/approve/issue/certify/pay pipeline. */
export async function createProgressClaimFromDocument(
  db: TenantContext,
  organisationId: string,
  userId: string,
  generatedDocumentId: string,
  statDeclarationFileId?: string | null
) {
  const doc = await db.generatedDocument.findFirst({ where: { id: generatedDocumentId, type: "PROGRESS_CLAIM" } });
  if (!doc || !doc.projectId) throw new NotFoundError("Progress claim document not found");

  const existing = await db.progressClaim.findFirst({ where: { generatedDocumentId } });
  if (existing) return existing;

  const snapshot = doc.dataSnapshotJson as ProgressClaimSnapshot;

  const claim = await db.progressClaim.create({
    data: {
      organisationId,
      projectId: doc.projectId,
      generatedDocumentId: doc.id,
      number: doc.number,
      claimedAmountExGst: snapshot.totals.subtotalExGst,
      claimedAmountIncGst: snapshot.totals.totalIncGst,
      statDeclarationFileId: statDeclarationFileId ?? null,
      status: DRAFT,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "progress_claim.create",
    entityType: "ProgressClaim",
    entityId: claim.id,
    after: { number: claim.number, claimedAmountExGst: claim.claimedAmountExGst },
  });

  return claim;
}

export async function listProgressClaims(db: TenantContext, filter: { projectId?: string }) {
  return db.progressClaim.findMany({
    where: filter.projectId ? { projectId: filter.projectId } : {},
    include: { generatedDocument: { select: { id: true, pdfFileId: true, xlsxFileId: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function attachStatDeclaration(db: TenantContext, organisationId: string, userId: string, claimId: string, statDeclarationFileId: string) {
  const existing = await db.progressClaim.findFirst({ where: { id: claimId } });
  if (!existing) throw new NotFoundError("Progress claim not found");

  return db.progressClaim.update({ where: { id: claimId }, data: { statDeclarationFileId } });
}

async function assertStatus(claim: { status: string }, expected: string, action: string) {
  if (claim.status !== expected) {
    throw new BadRequestError(`Cannot ${action} a claim that isn't currently "${expected}" (it's "${claim.status}").`);
  }
}

export async function submitProgressClaimForReview(db: TenantContext, organisationId: string, userId: string, claimId: string) {
  const config = await loadFinanceConfig(organisationId);
  assertInList(UNDER_REVIEW, config.progressClaimStatusList, "status");

  const existing = await db.progressClaim.findFirst({ where: { id: claimId } });
  if (!existing) throw new NotFoundError("Progress claim not found");
  await assertStatus(existing, DRAFT, "submit for review");

  const claim = await db.progressClaim.update({ where: { id: claimId }, data: { status: UNDER_REVIEW } });
  await auditLog({ organisationId, userId, action: "progress_claim.submit_review", entityType: "ProgressClaim", entityId: claim.id });
  return claim;
}

/** The internal sign-off gate — requires the statutory declaration to already be attached, ahead of being marked issued. */
export async function approveProgressClaim(db: TenantContext, organisationId: string, userId: string, claimId: string) {
  const existing = await db.progressClaim.findFirst({ where: { id: claimId } });
  if (!existing) throw new NotFoundError("Progress claim not found");
  await assertStatus(existing, UNDER_REVIEW, "approve");
  if (!existing.statDeclarationFileId) {
    throw new BadRequestError("The statutory declaration must be attached before a progress claim can be approved.");
  }

  const claim = await db.progressClaim.update({
    where: { id: claimId },
    data: { status: APPROVED, decidedByUserId: userId, decidedAt: new Date() },
  });
  await auditLog({ organisationId, userId, action: "progress_claim.approve", entityType: "ProgressClaim", entityId: claim.id });
  return claim;
}

/** Marks the claim issued to the client — the point retention is computed and locked, and "claimed to date" starts counting it. */
export async function issueProgressClaim(db: TenantContext, organisationId: string, userId: string, claimId: string) {
  const existing = await db.progressClaim.findFirst({ where: { id: claimId } });
  if (!existing) throw new NotFoundError("Progress claim not found");
  await assertStatus(existing, APPROVED, "issue");

  const config = await loadFinanceConfig(organisationId);
  const contractValue = await loadAdjustedContractValue(db, existing.projectId);
  const priorClaims = await db.progressClaim.findMany({
    where: { projectId: existing.projectId, status: { in: [ISSUED, CERTIFIED, PAID] }, id: { not: claimId } },
  });
  const cumulativeRetentionHeldBefore = priorClaims.reduce((sum, c) => sum + c.retentionHeld, 0);

  const { retentionThisClaim } = calcRetentionForClaim({
    claimAmountExGst: existing.claimedAmountExGst,
    cumulativeRetentionHeldBefore,
    contractValue,
    ratePct: config.retentionRatePct,
    capPct: config.retentionCapPct,
  });

  const claim = await db.progressClaim.update({
    where: { id: claimId },
    data: { status: ISSUED, issuedAt: new Date(), retentionPct: config.retentionRatePct, retentionHeld: retentionThisClaim },
  });

  await auditLog({
    organisationId,
    userId,
    action: "progress_claim.issue",
    entityType: "ProgressClaim",
    entityId: claim.id,
    after: { retentionHeld: retentionThisClaim },
  });

  return claim;
}

export async function certifyProgressClaim(db: TenantContext, organisationId: string, userId: string, claimId: string, certifiedAmount: number) {
  const existing = await db.progressClaim.findFirst({ where: { id: claimId } });
  if (!existing) throw new NotFoundError("Progress claim not found");
  await assertStatus(existing, ISSUED, "certify");

  const claim = await db.progressClaim.update({
    where: { id: claimId },
    data: { status: CERTIFIED, certifiedAmount, certifiedAt: new Date() },
  });
  await auditLog({ organisationId, userId, action: "progress_claim.certify", entityType: "ProgressClaim", entityId: claim.id, after: { certifiedAmount } });
  return claim;
}

export async function payProgressClaim(
  db: TenantContext,
  organisationId: string,
  userId: string,
  claimId: string,
  paidAmount: number,
  paidAt?: Date
) {
  const existing = await db.progressClaim.findFirst({ where: { id: claimId } });
  if (!existing) throw new NotFoundError("Progress claim not found");
  if (existing.status !== CERTIFIED && existing.status !== ISSUED) {
    throw new BadRequestError(`Cannot record payment on a claim that isn't Issued or Certified (it's "${existing.status}").`);
  }

  const claim = await db.progressClaim.update({
    where: { id: claimId },
    data: { status: PAID, paidAmount, paidAt: paidAt ?? new Date() },
  });
  await auditLog({ organisationId, userId, action: "progress_claim.pay", entityType: "ProgressClaim", entityId: claim.id, after: { paidAmount } });
  return claim;
}
