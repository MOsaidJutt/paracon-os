import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";

/** Writes a minimal-but-real Tender Tracker workbook (the 3 required sheets) to a temp file for upload in e2e tests. */
export function writeTenderTrackerFixture(projectName: string, clientName: string): string {
  const wb = XLSX.utils.book_new();

  const tenderSheet = XLSX.utils.aoa_to_sheet([
    ["Project Name", "Project Address", "Status", "Received", "Due", "Submitted", "Value", "Client", "Contact", "Win Probability", "Bid Decision", "Intent"],
    [projectName, "1 E2E Street, Melbourne VIC", "In Progress", "2026-01-01", "2026-01-15", "", 250000, clientName, "", "High", "Go", "Pursue"],
  ]);
  const clientSheet = XLSX.utils.aoa_to_sheet([
    ["Status", "Client", "Address", "Contact", "Email", "Phone", "Mobile", "Comments"],
    ["Pricing", clientName, "2 E2E Street", "Jane Doe", "jane@example.com", "0400000000", "", ""],
  ]);
  const supplierSheet = XLSX.utils.aoa_to_sheet([
    ["Trades", "Company", "Contact", "Position", "Email", "Phone", "Mobile", "Comments"],
    ["Aluminium", `E2E Supplier ${Date.now()}`, "John Smith", "Manager", "john@example.com", "0400000001", "", ""],
  ]);

  XLSX.utils.book_append_sheet(wb, tenderSheet, "Tender Register new");
  XLSX.utils.book_append_sheet(wb, clientSheet, "Client Directory");
  XLSX.utils.book_append_sheet(wb, supplierSheet, "Supplier Directory");

  const filePath = path.join(os.tmpdir(), `tender-tracker-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  XLSX.writeFile(wb, filePath);
  return filePath;
}

/**
 * Writes a minimal ZZTakeoff-style quantity export (matches the Breakdown
 * sheet shape from intake notes §7). The remarks column carries a unique
 * marker per call — content-hash idempotency means a byte-identical file
 * from an earlier run would otherwise short-circuit as "already imported".
 */
export function writeZztakeoffFixture(): string {
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Description", "Quantity", "UoM", "Unit Rate", "Amount", "Remarks"],
    ["Solid Partition - P1", 84, "lm", 145, 12180, `Level 3 (${marker})`],
    ["Glass Partition - G1", 22, "lm", 310, 6820, ""],
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, "Breakdown");

  const filePath = path.join(os.tmpdir(), `zztakeoff-${marker}.xlsx`);
  XLSX.writeFile(wb, filePath);
  return filePath;
}

/** Writes a bulk document zip with one entry under `projectFolderName/` so the bulk-zip importer auto-matches it to that project. */
export function writeBulkDocsZipFixture(projectFolderName: string, entryFileName: string): string {
  const zip = new AdmZip();
  zip.addFile(`${projectFolderName}/Variations/${entryFileName}`, Buffer.from("E2E test variation content"));

  const filePath = path.join(os.tmpdir(), `bulk-docs-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
  zip.writeZip(filePath);
  return filePath;
}

export function cleanupFixture(filePath: string): void {
  fs.rm(filePath, { force: true }, () => undefined);
}

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Writes a real, valid 1x1 PNG so the upload + inline image-preview flow can be exercised end-to-end. */
export function writeTinyPngFixture(fileName = "e2e-test-image.png"): string {
  const filePath = path.join(os.tmpdir(), `${uniqueSuffix()}-${fileName}`);
  fs.writeFileSync(filePath, Buffer.from(TINY_PNG_BASE64, "base64"));
  return filePath;
}

/** Writes a plain-text file (used to exercise the "no inline preview available" fallback path). */
export function writeTextFixture(fileName = "e2e-test-doc.txt", content = "E2E test document content"): string {
  const filePath = path.join(os.tmpdir(), `${uniqueSuffix()}-${fileName}`);
  fs.writeFileSync(filePath, content);
  return filePath;
}
