import type { TenantContext } from "@/lib/tenant";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { auditLog } from "@/lib/audit";
import { assertInList, loadFinanceConfig } from "./config";
import { calcRetentionHeldToDate } from "./retention";
import type { CreateRetentionReleaseInput } from "@/lib/validations/retention-release";

export async function createRetentionRelease(
  db: TenantContext,
  organisationId: string,
  userId: string,
  input: CreateRetentionReleaseInput
) {
  const project = await db.project.findFirst({ where: { id: input.projectId } });
  if (!project) throw new NotFoundError("Project not found");

  const config = await loadFinanceConfig(organisationId);
  assertInList(input.type, config.retentionReleaseTypeList, "type");

  const [claims, releases] = await Promise.all([
    db.progressClaim.findMany({ where: { projectId: input.projectId, status: { in: ["Issued", "Certified", "Paid"] } } }),
    db.retentionRelease.findMany({ where: { projectId: input.projectId } }),
  ]);
  const retentionHeldToDate = calcRetentionHeldToDate(
    claims.map((c) => c.retentionHeld),
    releases.map((r) => r.amount)
  );

  if (input.amount > retentionHeldToDate) {
    throw new BadRequestError(
      `Cannot release $${input.amount.toFixed(2)} — only $${retentionHeldToDate.toFixed(2)} retention is currently held on this project.`
    );
  }

  const release = await db.retentionRelease.create({
    data: {
      organisationId,
      projectId: input.projectId,
      amount: input.amount,
      type: input.type,
      note: input.note ?? null,
      recordedByUserId: userId,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "retention_release.create",
    entityType: "RetentionRelease",
    entityId: release.id,
    after: { amount: release.amount, type: release.type },
  });

  return release;
}

export async function listRetentionReleases(db: TenantContext, projectId: string) {
  return db.retentionRelease.findMany({ where: { projectId }, orderBy: { releasedAt: "desc" } });
}
