import * as XLSX from "xlsx";
import type { ProgressClaimLineResult } from "../progress-claim-calc";
import type { ProgressClaimSnapshot } from "../types";

function lineRow(line: ProgressClaimLineResult): unknown[] {
  return [line.name, line.percentCompleted / 100, line.contractValue, line.valueToBeInvoiced, line.previouslyClaimed, line.thisClaim];
}

function subtotalRow(label: string, subtotal: { contractValue: number; valueToBeInvoiced: number; previouslyClaimed: number; thisClaim: number }): unknown[] {
  return [label, "", subtotal.contractValue, subtotal.valueToBeInvoiced, subtotal.previouslyClaimed, subtotal.thisClaim];
}

/**
 * Mirrors Invoice Proforma Template.xlsx (intake notes §6): project+address ->
 * "PROGRESS CLAIM #N" + date -> the 6 columns -> CONTRACT WORK rows + Subtotal
 * -> VARIATIONS rows + Subtotal -> Subtotal (ex GST) / GST / Total (inc GST).
 */
export function buildProgressClaimWorkbook(snapshot: ProgressClaimSnapshot): Buffer {
  const rows: unknown[][] = [
    [snapshot.projectName],
    [snapshot.projectAddress],
    [],
    [`PROGRESS CLAIM ${snapshot.number}`, "", "", "", "", snapshot.date],
    ["Description", "Percentage Completed", "Contract Value", "Value To Be Invoiced", "Previously Claimed", "This Claim"],
    ["CONTRACT WORK"],
    ...snapshot.contractWorkLines.map(lineRow),
    subtotalRow("Subtotal", snapshot.totals.contractWork),
    [],
    ["VARIATIONS"],
    ...snapshot.variationLines.map(lineRow),
    subtotalRow("Subtotal", snapshot.totals.variations),
    [],
    ["Subtotal (ex GST)", "", "", "", "", snapshot.totals.subtotalExGst],
    ["GST", "", "", "", "", snapshot.totals.gst],
    ["Total (inc GST)", "", "", "", "", snapshot.totals.totalIncGst],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];

  // Number format on the %Completed column (row index 6 onward, column B) — matches the
  // source template's percentage display while the underlying value stays a 0-1 fraction.
  for (let r = 6; r < 6 + snapshot.contractWorkLines.length; r++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cell) cell.z = "0%";
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `CLAIM ${snapshot.number}`.slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
