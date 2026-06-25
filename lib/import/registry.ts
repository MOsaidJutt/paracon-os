import { NotFoundError } from "@/lib/errors";
import { tenderTrackerImporter } from "./importers/tender-tracker";
import { documentBulkZipImporter } from "./importers/document-bulk-zip";
import { zztakeoffImporter } from "./importers/zztakeoff";
import type { Importer } from "./types";

const IMPORTERS: Record<string, Importer> = {
  [tenderTrackerImporter.key]: tenderTrackerImporter,
  [documentBulkZipImporter.key]: documentBulkZipImporter,
  [zztakeoffImporter.key]: zztakeoffImporter,
};

export function getImporter(key: string): Importer {
  const importer = IMPORTERS[key];
  if (!importer) throw new NotFoundError(`Unknown importer "${key}"`);
  return importer;
}

export type ImporterSummary = Pick<Importer, "key" | "label" | "description" | "acceptedExtensions" | "requiresExtra">;

export function listImporters(): ImporterSummary[] {
  return Object.values(IMPORTERS).map(({ key, label, description, acceptedExtensions, requiresExtra }) => ({
    key,
    label,
    description,
    acceptedExtensions,
    requiresExtra,
  }));
}
