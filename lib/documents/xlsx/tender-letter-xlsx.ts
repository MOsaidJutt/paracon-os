import * as XLSX from "xlsx";
import type { TenderLetterSnapshot } from "../types";

/**
 * Mirrors the real Tender Letter xlsx (master blank + Uni Lodge live
 * instance, intake notes §7): "Number as per Tender Register" / "Revision
 * no." -> letterhead -> "Zztakeoff X% margin" -> date/company/address/
 * contact -> project+address -> salutation -> TENDER DOCUMENTATION -> TENDER
 * PRICE -> SCOPE OF WORKS (grouped by section, the checked library items) ->
 * QUALIFICATIONS -> sign-off. The source file's hidden boolean-flag helper
 * columns aren't reproduced here — the scope library + per-letter custom
 * lines (lib/documents/templates-config.ts) replace them with a real,
 * structured config instead of spreadsheet booleans.
 */
export function buildTenderLetterWorkbook(snapshot: TenderLetterSnapshot): Buffer {
  const partitionsAndDoors = snapshot.scopeLines.filter((l) => l.section === "Partitions & Doors");
  const ceiling = snapshot.scopeLines.filter((l) => l.section === "Ceiling");

  const rows: unknown[][] = [
    ["", "", "", "", "", "", "", "", "", "Number as per Tender Register", snapshot.number],
    ["", "", "", "", "", "", "", "", "", "Revision no.", snapshot.version - 1],
    [],
    [`${snapshot.org.legalName}    ABN ${snapshot.org.abn}`],
    [snapshot.org.registeredAddress],
    [],
    ["", "", "", "", "", "", "", "", "Zztakeoff", snapshot.marginPct, "% margin"],
    ["Date", snapshot.date],
    ["Company", snapshot.company],
    ["Address", snapshot.companyAddress],
    ["Contact", snapshot.contactName],
    ["", snapshot.contactEmail],
    ["Project", snapshot.projectName],
    ["", snapshot.projectAddress],
    [],
    [`Dear ${snapshot.contactName.split(" ")[0] || snapshot.contactName},`],
    [],
    ["We thank you for the opportunity to provide our tender for the above project, generally in accordance"],
    ["with the documentation provided."],
    [],
    ["TENDER DOCUMENTATION"],
    [
      "Drawings",
      `Documentation contained within Tender Request${snapshot.documentationReceivedDate ? ` (received ${snapshot.documentationReceivedDate})` : ""}`,
    ],
    ["Specifications", snapshot.specifications],
    ["Addendums", snapshot.addendums],
    [],
    ["TENDER PRICE"],
    ...snapshot.tenderPrice.tradeLines.map((line) => [line.name, line.sellAmount]),
    ["Subtotal (excl GST)", snapshot.tenderPrice.subtotalExGst],
    ["GST", snapshot.tenderPrice.gst],
    ["Total (inc GST)", snapshot.tenderPrice.totalIncGst],
    [],
    ["SCOPE OF WORKS"],
    ["     Partitions & Doors"],
    ...partitionsAndDoors.map((line) => [`•   ${line.code ? `${line.code} ` : ""}${line.label}`]),
    [],
    ["     Ceiling"],
    ...ceiling.map((line) => [`•   ${line.code ? `${line.code} ` : ""}${line.label}`]),
    [],
    ["QUALIFICATIONS"],
    ...snapshot.qualifications.map((q) => [`•   ${q}`]),
    [],
    ["We trust the above meets with your requirement and keenly await for further instructions."],
    [],
    ["Yours Sincerely,"],
    [],
    [snapshot.signOffName],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 18 }, { wch: 70 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tender Letter");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
