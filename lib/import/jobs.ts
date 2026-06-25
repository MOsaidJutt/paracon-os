import { createHash } from "crypto";
import type { TenantContext } from "@/lib/tenant";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { deleteObject, getObjectBuffer, putObject } from "@/lib/storage";
import { buildImportStagingKey } from "@/lib/documents/storage-keys";
import { getImporter } from "./registry";
import type { ImporterContext } from "./types";

export const IMPORT_MAX_BYTES = 150 * 1024 * 1024;

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Stages the raw upload in storage (so commit — and any column-map refine
 * step — doesn't need the file re-sent), records an ImportJob, and runs the
 * importer's preview. If this exact file was already committed for this
 * org+importer before, short-circuits with the prior report instead of
 * staging/parsing again — the idempotency the brief asks for.
 */
export async function stageImport(
  db: TenantContext,
  organisationId: string,
  userId: string,
  importerKey: string,
  fileName: string,
  buffer: Buffer,
  extra?: Record<string, unknown>
): Promise<{ importJobId: string; alreadyImported: boolean; importedAt?: Date; plan: unknown; summary: unknown }> {
  const importer = getImporter(importerKey);
  const contentHash = hashBuffer(buffer);

  const alreadyCommitted = await db.importJob.findFirst({
    where: { importerKey, contentHash, status: "COMMITTED" },
    orderBy: { createdAt: "desc" },
  });
  if (alreadyCommitted) {
    return {
      importJobId: alreadyCommitted.id,
      alreadyImported: true,
      importedAt: alreadyCommitted.updatedAt,
      plan: null,
      summary: alreadyCommitted.summaryJson,
    };
  }

  const job = await db.importJob.create({
    data: { organisationId, importerKey, fileName, contentHash, status: "PENDING", createdByUserId: userId },
  });

  const stagedKey = buildImportStagingKey(organisationId, job.id, fileName);
  await putObject(stagedKey, buffer, "application/octet-stream");
  await db.importJob.update({ where: { id: job.id }, data: { stagedKey } });

  const ctx: ImporterContext = { db, organisationId, userId, importJobId: job.id };
  const { plan, summary } = await importer.parsePreview(buffer, ctx, extra);

  return { importJobId: job.id, alreadyImported: false, plan, summary };
}

/**
 * Re-runs the importer's preview against an ALREADY-staged file with refined
 * `extra` input (e.g. a chosen column map) — no re-upload needed. Used for
 * the "upload → column-map → preview" step of importers like ZZTakeoff that
 * need user input the first preview call couldn't have known yet.
 */
export async function refinePreview(
  db: TenantContext,
  organisationId: string,
  userId: string,
  importerKey: string,
  importJobId: string,
  extra?: Record<string, unknown>
): Promise<{ plan: unknown; summary: unknown }> {
  const importer = getImporter(importerKey);
  const job = await db.importJob.findFirst({ where: { id: importJobId, importerKey } });
  if (!job) throw new NotFoundError("Import job not found");
  if (job.status === "COMMITTED") throw new BadRequestError("This import has already been committed");
  if (!job.stagedKey) throw new BadRequestError("Import job has no staged file");

  const buffer = await getObjectBuffer(job.stagedKey);
  const ctx: ImporterContext = { db, organisationId, userId, importJobId: job.id };
  return importer.parsePreview(buffer, ctx, extra);
}

/**
 * Re-fetches the staged buffer and runs the importer's commit. Re-committing
 * the same already-COMMITTED job is a no-op that returns the stored report
 * rather than re-applying side effects.
 */
export async function commitImport(
  db: TenantContext,
  organisationId: string,
  userId: string,
  importerKey: string,
  importJobId: string,
  extra?: Record<string, unknown>
): Promise<{ report: unknown; alreadyImported: boolean }> {
  const importer = getImporter(importerKey);
  const job = await db.importJob.findFirst({ where: { id: importJobId, importerKey } });
  if (!job) throw new NotFoundError("Import job not found");

  if (job.status === "COMMITTED") {
    return { report: job.summaryJson, alreadyImported: true };
  }
  if (!job.stagedKey) throw new BadRequestError("Import job has no staged file to commit");

  const buffer = await getObjectBuffer(job.stagedKey);
  const ctx: ImporterContext = { db, organisationId, userId, importJobId: job.id };

  try {
    const { report } = await importer.commit(buffer, ctx, extra);
    await db.importJob.update({
      where: { id: job.id },
      data: { status: "COMMITTED", summaryJson: report as object },
    });
    await deleteObject(job.stagedKey).catch(() => undefined);
    return { report, alreadyImported: false };
  } catch (error) {
    await db.importJob.update({ where: { id: job.id }, data: { status: "FAILED" } });
    throw error;
  }
}
