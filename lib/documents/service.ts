import type { TenantContext } from "@/lib/tenant";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import {
  deleteObject,
  generateAndStorePreview,
  getPresignedUploadUrl,
  getSignedReadUrl,
} from "@/lib/storage";
import type {
  CreateLinkedDocumentInput,
  RegisterNewVersionInput,
  RegisterStoredFileInput,
  RequestUploadUrlInput,
  UpdateLinkedDocumentInput,
  UpdateStoredFileInput,
} from "@/lib/validations/document";
import { assertInList, GENERAL_CATEGORY, type DocumentConfig } from "./config";
import { buildDocumentKey, buildPreviewKey } from "./storage-keys";

export type DocumentTarget = { projectId?: string | null; tenderId?: string | null; workerId?: string | null };

export type UnifiedDocumentRow = {
  source: "stored" | "linked";
  id: string;
  name: string;
  category: string;
  mime: string | null;
  size: number | null;
  version: number | null;
  hasPreview: boolean;
  tags: string[];
  driveUrl: string | null;
  byName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function storedFileWhere(target: DocumentTarget): { projectId: string } | { tenderId: string } | { workerId: string } {
  if (target.projectId) return { projectId: target.projectId };
  if (target.tenderId) return { tenderId: target.tenderId };
  if (target.workerId) return { workerId: target.workerId };
  throw new BadRequestError("A target (project, tender or worker) is required");
}

/** LinkedDocument has no workerId column — large CAD links only ever attach to a project or tender. */
function linkedDocumentWhere(target: DocumentTarget): { projectId: string } | { tenderId: string } | null {
  if (target.projectId) return { projectId: target.projectId };
  if (target.tenderId) return { tenderId: target.tenderId };
  return null;
}

/** A document's category must be one of the panel's configured sections for whichever entity it's attached to. */
export function validateCategory(
  target: { projectId?: string | null; tenderId?: string | null },
  category: string,
  config: DocumentConfig
): void {
  if (target.projectId) {
    assertInList(category, config.projectCategoryList, "category");
  } else if (target.tenderId) {
    assertInList(category, config.tenderCategoryList, "category");
  } else {
    assertInList(category, [...config.projectCategoryList, ...config.tenderCategoryList, GENERAL_CATEGORY], "category");
  }
}

/** Confirms the project/tender/worker a document is being attached to actually exists in this org before any write — 404s rather than letting a cross-tenant id slip through. */
export async function assertTargetExists(db: TenantContext, target: DocumentTarget): Promise<void> {
  if (target.projectId) {
    const project = await db.project.findFirst({ where: { id: target.projectId } });
    if (!project) throw new NotFoundError("Project not found");
  } else if (target.tenderId) {
    const tender = await db.tender.findFirst({ where: { id: target.tenderId } });
    if (!tender) throw new NotFoundError("Tender not found");
  } else if (target.workerId) {
    const worker = await db.worker.findFirst({ where: { id: target.workerId } });
    if (!worker) throw new NotFoundError("Worker not found");
  } else {
    throw new BadRequestError("A target (project, tender or worker) is required");
  }
}

/** Merges StoredFile + LinkedDocument for one target into a single, date-sorted list — the unified documents panel never shows nested folders. */
export async function listDocuments(db: TenantContext, target: DocumentTarget): Promise<UnifiedDocumentRow[]> {
  const storedWhere = storedFileWhere(target);
  const linkedWhere = linkedDocumentWhere(target);

  const [stored, linked] = await Promise.all([
    db.storedFile.findMany({
      where: storedWhere,
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    linkedWhere
      ? db.linkedDocument.findMany({
          where: linkedWhere,
          include: { addedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const storedRows: UnifiedDocumentRow[] = stored.map((f) => ({
    source: "stored",
    id: f.id,
    name: f.name,
    category: f.category,
    mime: f.mime,
    size: f.size,
    version: f.version,
    hasPreview: !!f.previewKey,
    tags: Array.isArray(f.tagsJson) ? (f.tagsJson as string[]) : [],
    driveUrl: null,
    byName: f.uploadedBy?.name ?? null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));

  const linkedRows: UnifiedDocumentRow[] = linked.map((d) => ({
    source: "linked",
    id: d.id,
    name: d.name,
    category: d.kind,
    mime: null,
    size: null,
    version: null,
    hasPreview: false,
    tags: [],
    driveUrl: d.driveUrl,
    byName: d.addedBy?.name ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

  return [...storedRows, ...linkedRows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Mints a presigned PUT URL so the browser uploads straight to storage — our server never sees the bytes. */
export async function requestUploadUrl(
  organisationId: string,
  input: RequestUploadUrlInput,
  config: DocumentConfig
): Promise<{ key: string; uploadUrl: string }> {
  validateCategory(input, input.category, config);
  const key = buildDocumentKey(organisationId, input, input.fileName);
  const uploadUrl = await getPresignedUploadUrl(key, input.mime);
  return { key, uploadUrl };
}

/** A registered key must fall under this org's own prefix — never trust a client-supplied key blindly, or one org could register metadata pointing at another org's (or a forged) storage object. */
function assertOwnedKey(organisationId: string, key: string): void {
  if (!key.startsWith(`documents/${organisationId}/`)) throw new BadRequestError("Invalid storage key");
}

/** Registers a StoredFile row for an object the client already PUT to storage, deriving a preview thumbnail for images. */
export async function registerStoredFile(
  db: TenantContext,
  organisationId: string,
  userId: string,
  input: RegisterStoredFileInput,
  config: DocumentConfig
) {
  validateCategory(input, input.category, config);
  assertOwnedKey(organisationId, input.key);
  const previewKey = await generateAndStorePreview(input.key, input.mime, buildPreviewKey(input.key));

  return db.storedFile.create({
    data: {
      organisationId,
      key: input.key,
      name: input.fileName,
      mime: input.mime,
      size: input.size,
      category: input.category,
      previewKey,
      tagsJson: input.tags ?? [],
      projectId: input.projectId ?? null,
      tenderId: input.tenderId ?? null,
      workerId: input.workerId ?? null,
      uploadedByUserId: userId,
    },
  });
}

/** Mints a presigned PUT URL for a NEW version of an existing document, reusing its existing target/category. */
export async function requestNewVersionUploadUrl(
  db: TenantContext,
  organisationId: string,
  storedFileId: string,
  fileName: string,
  mime: string
): Promise<{ key: string; uploadUrl: string }> {
  const existing = await db.storedFile.findFirst({ where: { id: storedFileId } });
  if (!existing) throw new NotFoundError("Document not found");

  const key = buildDocumentKey(organisationId, existing, fileName);
  const uploadUrl = await getPresignedUploadUrl(key, mime);
  return { key, uploadUrl };
}

/**
 * Snapshots the current version into StoredFileVersion history (old object
 * key is never deleted from storage), then advances StoredFile to point at
 * the newly-uploaded key.
 */
export async function addNewVersion(
  db: TenantContext,
  organisationId: string,
  storedFileId: string,
  userId: string,
  input: RegisterNewVersionInput
) {
  const existing = await db.storedFile.findFirst({ where: { id: storedFileId } });
  if (!existing) throw new NotFoundError("Document not found");
  assertOwnedKey(organisationId, input.key);

  await db.storedFileVersion.create({
    data: {
      storedFileId: existing.id,
      key: existing.key,
      version: existing.version,
      size: existing.size,
      mime: existing.mime,
      uploadedByUserId: existing.uploadedByUserId,
    },
  });

  const previewKey = await generateAndStorePreview(input.key, input.mime, buildPreviewKey(input.key));

  return db.storedFile.update({
    where: { id: existing.id },
    data: {
      key: input.key,
      name: input.fileName,
      mime: input.mime,
      size: input.size,
      version: existing.version + 1,
      previewKey,
      uploadedByUserId: userId,
    },
  });
}

export async function listVersions(db: TenantContext, storedFileId: string) {
  const existing = await db.storedFile.findFirst({ where: { id: storedFileId } });
  if (!existing) throw new NotFoundError("Document not found");
  return db.storedFileVersion.findMany({ where: { storedFileId }, orderBy: { version: "desc" } });
}

export async function updateStoredFile(db: TenantContext, storedFileId: string, input: UpdateStoredFileInput, config: DocumentConfig) {
  const existing = await db.storedFile.findFirst({ where: { id: storedFileId } });
  if (!existing) throw new NotFoundError("Document not found");
  if (input.category) validateCategory(existing, input.category, config);

  return db.storedFile.update({
    where: { id: existing.id },
    data: {
      category: input.category ?? undefined,
      tagsJson: input.tags ?? undefined,
    },
  });
}

/** Deletes a document and every superseded version's object from storage — best-effort, never blocks on a storage-side failure. */
export async function deleteStoredFile(db: TenantContext, storedFileId: string): Promise<void> {
  const existing = await db.storedFile.findFirst({ where: { id: storedFileId }, include: { versions: true } });
  if (!existing) throw new NotFoundError("Document not found");

  const keys = [existing.key, existing.previewKey, ...existing.versions.map((v) => v.key)].filter(
    (k): k is string => !!k
  );
  await Promise.all(keys.map((key) => deleteObject(key).catch(() => undefined)));
  await db.storedFile.delete({ where: { id: existing.id } });
}

export async function getSignedDocumentUrl(db: TenantContext, storedFileId: string, preview: boolean): Promise<string> {
  const existing = await db.storedFile.findFirst({ where: { id: storedFileId } });
  if (!existing) throw new NotFoundError("Document not found");
  const key = preview && existing.previewKey ? existing.previewKey : existing.key;
  return getSignedReadUrl(key);
}

export async function getSignedVersionUrl(db: TenantContext, storedFileId: string, versionId: string): Promise<string> {
  const existing = await db.storedFile.findFirst({ where: { id: storedFileId } });
  if (!existing) throw new NotFoundError("Document not found");
  const version = await db.storedFileVersion.findFirst({ where: { id: versionId, storedFileId } });
  if (!version) throw new NotFoundError("Version not found");
  return getSignedReadUrl(version.key);
}

export async function createLinkedDocument(
  db: TenantContext,
  organisationId: string,
  userId: string,
  input: CreateLinkedDocumentInput,
  config: DocumentConfig
) {
  assertInList(input.kind, config.linkedKindList, "kind");

  return db.linkedDocument.create({
    data: {
      organisationId,
      name: input.name,
      driveUrl: input.driveUrl,
      kind: input.kind,
      projectId: input.projectId ?? null,
      tenderId: input.tenderId ?? null,
      addedByUserId: userId,
    },
  });
}

export async function updateLinkedDocument(
  db: TenantContext,
  linkedDocumentId: string,
  input: UpdateLinkedDocumentInput,
  config: DocumentConfig
) {
  const existing = await db.linkedDocument.findFirst({ where: { id: linkedDocumentId } });
  if (!existing) throw new NotFoundError("Linked document not found");
  if (input.kind) assertInList(input.kind, config.linkedKindList, "kind");

  return db.linkedDocument.update({
    where: { id: existing.id },
    data: {
      name: input.name ?? undefined,
      driveUrl: input.driveUrl ?? undefined,
      kind: input.kind ?? undefined,
    },
  });
}

export async function deleteLinkedDocument(db: TenantContext, linkedDocumentId: string): Promise<void> {
  const existing = await db.linkedDocument.findFirst({ where: { id: linkedDocumentId } });
  if (!existing) throw new NotFoundError("Linked document not found");
  await db.linkedDocument.delete({ where: { id: existing.id } });
}
