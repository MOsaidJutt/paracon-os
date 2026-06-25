// Import the inner lib directly, not the package root — pdf-parse's index.js
// runs a debug self-test (reading a hardcoded sample PDF) whenever
// `module.parent` is falsy, which is exactly what happens once webpack
// bundles it for a Next.js server build, breaking `next build`.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

/**
 * Best-effort text-layer extraction from a PDF attachment — used only to scan
 * for the P##-#### job-number pattern (lib/finance/job-number-match.ts), not
 * OCR or AI. Returns "" rather than throwing on a malformed/scanned-image PDF
 * so an ingestion failure here never blocks the bill from landing in the
 * Unallocated tray for manual handling.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    return result.text ?? "";
  } catch {
    return "";
  }
}
