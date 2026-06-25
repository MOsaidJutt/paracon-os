export type GeneratedDocumentTarget = { projectId: string } | { tenderId: string };

export type GeneratedDocumentRow = {
  id: string;
  type: "TENDER_LETTER" | "VARIATION" | "PROGRESS_CLAIM";
  number: string;
  version: number;
  status: string;
  pdfFileId: string | null;
  xlsxFileId: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
  dataSnapshotJson: Record<string, unknown>;
};

export const DOCUMENT_TYPE_LABEL: Record<GeneratedDocumentRow["type"], string> = {
  TENDER_LETTER: "Tender Letter",
  VARIATION: "Variation",
  PROGRESS_CLAIM: "Progress Claim",
};

export function generatedDocumentsQueryParam(target: GeneratedDocumentTarget): string {
  return "projectId" in target ? `projectId=${target.projectId}` : `tenderId=${target.tenderId}`;
}
