import { randomUUID } from "crypto";

type Target = { projectId?: string | null; tenderId?: string | null; workerId?: string | null };

function targetScope(target: Target): string {
  if (target.projectId) return `projects/${target.projectId}`;
  if (target.tenderId) return `tenders/${target.tenderId}`;
  if (target.workerId) return `workers/${target.workerId}`;
  throw new Error("Document target must have a projectId, tenderId or workerId");
}

// Keeps parentheses — real folder/file names in the source data encode status
// this way (e.g. "VQ-10_Day Labour Works 20-04-26 (WITHDRAWN)" in the Forever
// site file), and the bulk-zip importer carries those file names through.
function sanitizeFileName(fileName: string): string {
  return fileName.trim().replace(/[^A-Za-z0-9.\-_() ]/g, "").replace(/\s+/g, " ") || "file";
}

/**
 * Every object key is prefixed with a random id so re-uploading a file with
 * the same name never collides with — or silently overwrites — a prior
 * version's object; old keys stay in storage forever, referenced by
 * StoredFileVersion history.
 */
export function buildDocumentKey(organisationId: string, target: Target, fileName: string): string {
  return `documents/${organisationId}/${targetScope(target)}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export function buildPreviewKey(originalKey: string): string {
  return `${originalKey}.preview.jpg`;
}

export function buildImportStagingKey(organisationId: string, importJobId: string, fileName: string): string {
  return `import-staging/${organisationId}/${importJobId}-${sanitizeFileName(fileName)}`;
}
